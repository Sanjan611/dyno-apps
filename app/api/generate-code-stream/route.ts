import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";
import { b } from "@/baml_client";
import {
  BamlValidationError,
  BamlClientFinishReasonError,
  BamlAbortError,
  Collector,
} from "@boundaryml/baml";
import type {
  ListFilesTool,
  ReadFileTool,
  WriteFileTool,
  Message,
  ReplyToUser,
  FileTools,
  TodoItem,
  TodoWriteTool,
  TodoTools,
} from "@/baml_client/types";
import {
  executeSingleTool,
  executeParallelTools,
  extractFilesFromState,
  areAllTodosCompleted,
  extractToolParams,
} from "./tool-executors";

// Force dynamic route to enable streaming
export const dynamic = 'force-dynamic';

// Retry wrapper for CodingAgent with exponential backoff for validation errors
async function callCodingAgentWithRetry(
  state: Message[],
  workingDir: string,
  todoList: TodoItem[],
  collector: Collector,
  maxRetries: number = 3
): Promise<FileTools | (ListFilesTool | ReadFileTool)[] | TodoTools | ReplyToUser> {
  let lastError: BamlValidationError | BamlClientFinishReasonError | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await b.CodingAgent(
        state,
        workingDir,
        todoList,
        { collector }
      );
      
      // Success - return the response
      if (attempt > 0) {
        console.log(`[generate-code-stream] CodingAgent succeeded on retry attempt ${attempt}`);
      }
      return response;
    } catch (error) {
      // Only retry on BamlValidationError or BamlClientFinishReasonError
      if (
        error instanceof BamlValidationError ||
        error instanceof BamlClientFinishReasonError
      ) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // Calculate exponential backoff delay: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt) * 1000;
          console.log(
            `[generate-code-stream] CodingAgent validation error on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delayMs}ms...`
          );
          console.error(`[generate-code-stream] Validation error details:`, error.detailed_message || error.message);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          // All retries exhausted
          console.error(
            `[generate-code-stream] CodingAgent failed after ${maxRetries + 1} attempts with validation error`
          );
        }
      } else {
        // Non-retryable error (BamlAbortError, network errors, etc.) - throw immediately
        throw error;
      }
    }
  }
  
  // If we get here, all retries were exhausted
  if (lastError) {
    throw lastError;
  }
  
  // This should never happen, but TypeScript needs it
  throw new Error("Unexpected error in retry logic");
}

// Helper function to send error via SSE stream
function sendErrorViaStream(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  error: unknown,
  context: string = ""
): void {
  const contextPrefix = context ? `${context} ` : "";
  let errorMessage = "Unknown error";
  let errorDetails: any = undefined;

  if (error instanceof BamlAbortError) {
    errorMessage = `${contextPrefix}operation was cancelled`;
    errorDetails = error.reason || error.message;
    console.error(`[generate-code-stream] ${errorMessage}:`, error.message);
    console.error(`[generate-code-stream] Cancellation reason:`, error.reason);
  } else if (error instanceof BamlValidationError || error instanceof BamlClientFinishReasonError) {
    errorMessage = `${contextPrefix}encountered a BAML error`;
    errorDetails = error.detailed_message || error.message;
    console.error(`[generate-code-stream] ${errorMessage}:`, error.message);
    console.error(`[generate-code-stream] BAML error detailed message:`, error.detailed_message);
    if (error.prompt) {
      // console.error(`[generate-code-stream] BAML error prompt:`, error.prompt);
    }
    if (error.raw_output) {
      console.error(`[generate-code-stream] BAML error raw output:`, error.raw_output);
    }
  } else {
    errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("BamlError:")) {
      console.error(`[generate-code-stream] ${contextPrefix}BAML error:`, errorMessage);
    } else {
      console.error(`[generate-code-stream] ${contextPrefix}Error:`, errorMessage);
      if (error instanceof Error) {
        console.error(`[generate-code-stream] Error stack:`, error.stack);
        errorDetails = error.stack;
      }
    }
  }

  const errorEvent = {
    type: 'error',
    error: errorMessage,
    details: errorDetails,
  };

  writer.write(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)).catch(console.error);
}

export async function POST(request: NextRequest) {
  // Create SSE stream infrastructure
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper function to send progress updates
  const sendProgress = async (data: object) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (error) {
      console.error("[generate-code-stream] Error writing to stream:", error);
    }
  };

  // Helper function to send keepalive comment (resets timeout without being parsed as data)
  const sendKeepalive = async () => {
    try {
      await writer.write(encoder.encode(': keepalive\n\n'));
    } catch (error) {
      // Ignore errors on keepalive
    }
  };

  // Start processing in background
  (async () => {
    try {
      const { userPrompt, sandboxId } = await request.json();
      console.log("[generate-code-stream] Starting code generation for sandbox:", sandboxId);

      // Validate input
      if (!userPrompt || !sandboxId) {
        console.error("[generate-code-stream] Error: userPrompt and sandboxId are required");
        await sendProgress({
          type: 'error',
          error: 'userPrompt and sandboxId are required',
        });
        await writer.close();
        return;
      }

      // Validate Anthropic API key (required by BAML)
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error("[generate-code-stream] Error: ANTHROPIC_API_KEY is not set");
        await sendProgress({
          type: 'error',
          error: 'ANTHROPIC_API_KEY environment variable is not configured',
        });
        await writer.close();
        return;
      }

      await sendProgress({ type: 'status', message: 'Initializing sandbox connection...' });

      // Initialize Modal client
      const modal = new ModalClient({
        tokenId: process.env.MODAL_TOKEN_ID,
        tokenSecret: process.env.MODAL_TOKEN_SECRET,
      });

      // Get the sandbox reference
      console.log("[generate-code-stream] Getting sandbox reference...");
      const sandbox = await modal.sandboxes.fromId(sandboxId);
      console.log("[generate-code-stream] Sandbox reference obtained:", sandbox.sandboxId);

      const workingDir = "/my-app";
      const maxIterations = 50;
      const modifiedFiles: Record<string, string> = {};

      // ============================================
      // CODING AGENT
      // ============================================
      console.log("[generate-code-stream] Starting code generation...");
      await sendProgress({ type: 'status', message: 'Starting code generation...' });
      
      // Create collector to track token usage and latency
      const collector = new Collector("code-generation");
      
      // Initialize empty todo list - the coding agent will create todos using todo_write
      // This aligns with Claude Code's approach where the agent manages the todo list
      let todoList: TodoItem[] = [];

      const state: Message[] = [
        {
          role: "user",
          message: userPrompt,
        },
      ];

      let iterations = 0;

      while (iterations < maxIterations) {
        iterations++;
        console.log(`[generate-code-stream] Iteration ${iterations}/${maxIterations}`);

        // Start keepalive interval during long LLM calls
        const keepaliveInterval = setInterval(() => {
          sendKeepalive();
        }, 15000); // Send keepalive every 15 seconds

        let response;
        try {
          response = await callCodingAgentWithRetry(
            state,
            workingDir,
            todoList,
            collector
          );
          
          // Log token usage and latency for this iteration
          if (collector.last) {
            console.log(`[generate-code-stream] CodingAgent iteration ${iterations} usage:`, {
              inputTokens: collector.last.usage?.inputTokens ?? null,
              outputTokens: collector.last.usage?.outputTokens ?? null,
              durationMs: collector.last.timing?.durationMs ?? null,
            });
          }
        } catch (e) {
          clearInterval(keepaliveInterval);
          sendErrorViaStream(writer, encoder, e, "Coding agent");
          await writer.close();
          return;
        } finally {
          clearInterval(keepaliveInterval);
        }

        // Check if coding agent is replying (done)
        if (response && "action" in response && response.action === "reply_to_user") {
          // Extract all modified files
          const allFiles =
            Object.keys(modifiedFiles).length > 0
              ? modifiedFiles
              : extractFilesFromState(state);

          const replyMessage = "message" in response ? response.message : "";
          console.log("[generate-code-stream] Coding agent completed with reply:", replyMessage);
          
          // Log cumulative token usage and latency
          console.log(`[generate-code-stream] CodingAgent complete - cumulative usage:`, {
            totalInputTokens: collector.usage?.inputTokens ?? null,
            totalOutputTokens: collector.usage?.outputTokens ?? null,
            totalCalls: collector.logs.length,
          });
          
          await sendProgress({
            type: 'complete',
            message: replyMessage,
            files: allFiles,
          });
          
          await writer.close();
          return;
        }

        // Execute the tool (single or parallel)
        const tool = response as FileTools | (ListFilesTool | ReadFileTool)[] | TodoTools;
        let toolName: string;
        let currentTodo: string | undefined = undefined;

        if (Array.isArray(tool)) {
          toolName = `parallel_read (${tool.length} files)`;
        } else if (tool.action === "todo_write") {
          toolName = tool.action;
          // Get the in-progress todo for progress display
          const updatedTodos = (tool as TodoWriteTool).todos;
          const inProgressTodo = updatedTodos.find(t => t.status === "in_progress");
          if (inProgressTodo) {
            currentTodo = inProgressTodo.content;
          }
        } else if (tool.action === "write_file") {
          toolName = tool.action;
          currentTodo = `Writing ${(tool as WriteFileTool).filePath}`;
        } else if (tool.action === "read_file") {
          toolName = tool.action;
          currentTodo = `Reading ${(tool as ReadFileTool).filePath}`;
        } else if (tool.action === "verify_expo_server") {
          toolName = tool.action;
          currentTodo = "Verifying Expo server status";
        } else {
          toolName = tool.action;
        }

        // Log tool parameters (excluding content for WriteFileTool)
        console.log(`[generate-code-stream] Tool call parameters:`, extractToolParams(tool));

        await sendProgress({
          type: 'coding_iteration',
          iteration: iterations,
          tool: toolName,
          todo: currentTodo,
        });

        let result: string;
        if (Array.isArray(tool)) {
          if (tool.length === 0) {
            result = "Error: Cannot execute parallel_read with empty array. Please provide at least one read_file or list_files tool, or use a single tool call instead.";
            console.error("[generate-code-stream] Attempted to execute parallel_read with empty array");
          } else {
            console.log(`[generate-code-stream] Executing parallel_read with ${tool.length} tools...`);
            result = await executeParallelTools(sandbox, tool, workingDir, todoList);
          }
        } else {
          console.log(`[generate-code-stream] Executing ${tool.action} tool...`);
          const execResult = await executeSingleTool(sandbox, tool, workingDir, todoList);
          result = execResult.result;
          
          // Handle side effects
          if (tool.action === "write_file" && !result.startsWith("Error")) {
            modifiedFiles[tool.filePath] = tool.content;
          } else if (tool.action === "todo_write" && execResult.updatedTodoList) {
            todoList = execResult.updatedTodoList;
            console.log("[generate-code-stream] Todo write result:", execResult.result);
            console.log("[generate-code-stream] Todo list updated:", execResult.updatedTodoList);
            
            // Send todo update event
            await sendProgress({
              type: 'todo_update',
              todos: todoList,
            });
            
            // Check if all todos are completed
            if (areAllTodosCompleted(todoList)) {
              console.log("[generate-code-stream] All todos completed, agent should reply to user");
            }
          }
        }

        // Add tool execution to state
        state.push({
          role: "assistant",
          message: tool,
        });
        state.push({
          role: "tool",
          message: result,
        });
      }

      // Handle timeout if loop exceeds max iterations
      console.error("[generate-code-stream] Coding agent exceeded maximum iterations");
      await sendProgress({
        type: 'error',
        error: 'Coding agent exceeded maximum iterations. Please try again with a simpler request.',
      });
      await writer.close();
    } catch (error) {
      console.error("[generate-code-stream] Error generating code:", error);
      sendErrorViaStream(writer, encoder, error);
      await writer.close();
    }
  })();

  // Return the stream with proper headers for SSE
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

