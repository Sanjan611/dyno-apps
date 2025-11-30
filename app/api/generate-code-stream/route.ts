import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";
import { dirname } from "path";
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
  BashTool,
  Message,
  ReplyToUser,
  FileTools,
  ReadOnlyTools,
  TodoItem,
  TodoWriteTool,
  TodoTools,
  ParallelReadTools,
} from "@/baml_client/types";

// Force dynamic route to enable streaming
export const dynamic = 'force-dynamic';

// Tool execution functions - return error strings on failure
async function executeListFiles(
  sandbox: any,
  tool: ListFilesTool
): Promise<string> {
  try {
    // Use ls command to list directory contents
    const lsProcess = await sandbox.exec(["ls", "-la", tool.directoryPath]);
    const output = await lsProcess.stdout.readText();
    await lsProcess.wait();
    
    // Parse the output to extract files and directories
    const lines = output.split("\n").filter((line: string) => line.trim());
    const files: string[] = [];
    const directories: string[] = [];
    
    // Skip the first line (total) and parse each line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 9) {
        const name = parts.slice(8).join(" ");
        // Skip . and ..
        if (name === "." || name === "..") continue;
        
        // Check if it's a directory (starts with 'd')
        if (parts[0].startsWith("d")) {
          directories.push(name);
        } else {
          files.push(name);
        }
      }
    }
    
    return `Listed directory ${tool.directoryPath}:\nFiles: ${files.join(", ")}\nDirectories: ${directories.join(", ")}`;
  } catch (error) {
    // Return error message so agent can handle it
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Error listing directory ${tool.directoryPath}: ${errorMessage}. Please check the path and try again.`;
  }
}

async function executeReadFile(
  sandbox: any,
  tool: ReadFileTool
): Promise<string> {
  try {
    const file = await sandbox.open(tool.filePath, "r");
    const content = await file.read();
    await file.close();
    const decoded = new TextDecoder().decode(content);
    return `Read file ${tool.filePath}:\n${decoded}`;
  } catch (error) {
    // Return error message so agent can handle it
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Error reading file ${tool.filePath}: ${errorMessage}. The file may not exist or the path may be incorrect.`;
  }
}

// Lint check function - runs Prettier (auto-fix) and ESLint, returns raw output
async function executeLintCheck(
  sandbox: any,
  workingDir: string
): Promise<string> {
  try {
    console.log("[generate-code-stream] Running lint check in", workingDir);
    
    // Run Prettier with --write to auto-fix formatting issues
    const prettierProcess = await sandbox.exec([
      "bash",
      "-c",
      `cd ${workingDir} && npx prettier --write "**/*.{js,jsx,ts,tsx}" 2>&1 || echo "Prettier check completed"`,
    ]);
    const prettierStdout = await prettierProcess.stdout.readText();
    const prettierStderr = await prettierProcess.stderr.readText();
    await prettierProcess.wait();

    console.log("[generate-code-stream] Prettier output:");
    if (prettierStdout) console.log("[generate-code-stream] Prettier stdout:", prettierStdout);
    if (prettierStderr) console.log("[generate-code-stream] Prettier stderr:", prettierStderr);

    // Run ESLint with default format (human-readable output)
    const eslintProcess = await sandbox.exec([
      "bash",
      "-c",
      `cd ${workingDir} && npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 999999 --no-error-on-unmatched-pattern 2>&1 || true`,
    ]);
    const eslintStdout = await eslintProcess.stdout.readText();
    const eslintStderr = await eslintProcess.stderr.readText();
    await eslintProcess.wait();

    console.log("[generate-code-stream] ESLint output:");
    if (eslintStdout) console.log("[generate-code-stream] ESLint stdout:", eslintStdout);
    if (eslintStderr) console.log("[generate-code-stream] ESLint stderr:", eslintStderr);
    if (!eslintStdout && !eslintStderr) {
      console.log("[generate-code-stream] ESLint: No issues found");
    }

    // Combine outputs into a single string
    let result = "Lint check results:\n\n";
    
    if (prettierStdout || prettierStderr) {
      result += "Prettier output:\n";
      if (prettierStdout) result += prettierStdout;
      if (prettierStderr) result += prettierStderr;
      result += "\n";
    }
    
    if (eslintStdout || eslintStderr) {
      result += "ESLint output:\n";
      if (eslintStdout) result += eslintStdout;
      if (eslintStderr) result += eslintStderr;
    } else {
      result += "ESLint: No issues found.\n";
    }

    // Truncate if too long (similar to bash command output)
    if (result.length > 30000) {
      result = result.substring(0, 30000) + "\n... (lint output truncated)";
    }

    console.log("[generate-code-stream] Lint check completed. Result length:", result.length, "characters");
    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Lint check encountered an error: ${errorMessage}. Continuing without lint results.`;
  }
}

async function executeWriteFile(
  sandbox: any,
  tool: WriteFileTool,
  workingDir: string
): Promise<string> {
  try {
    const dirPath = dirname(tool.filePath);
    if (dirPath && dirPath !== "/" && dirPath !== ".") {
      const mkdirProcess = await sandbox.exec(["mkdir", "-p", dirPath]);
      await mkdirProcess.wait();
    }

    const file = await sandbox.open(tool.filePath, "w");
    await file.write(new TextEncoder().encode(tool.content));
    await file.close();
    
    let result = `Successfully wrote file ${tool.filePath}`;
    
    // Run lint checks after successful write (only for files in working directory)
    if (tool.filePath.startsWith(workingDir) || tool.filePath.startsWith("/my-app")) {
      try {
        console.log("[generate-code-stream] Triggering lint check after writing file:", tool.filePath);
        const lintResults = await executeLintCheck(sandbox, workingDir);
        result += `\n\n${lintResults}`;
        console.log("[generate-code-stream] Lint check results:", lintResults);
      } catch (lintError) {
        // Don't fail the write operation if lint check fails
        console.error("[generate-code-stream] Lint check failed:", lintError);
        result += `\n\n(Lint check encountered an error, but file was written successfully)`;
      }
    }
    
    return result;
  } catch (error) {
    // Return error message so agent can handle it
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Error writing file ${tool.filePath}: ${errorMessage}. Please check the path and content format.`;
  }
}

// Parallel execution function for read operations
async function executeParallelReads(
  sandbox: any,
  tools: (ListFilesTool | ReadFileTool)[]
): Promise<string> {
  const results = await Promise.all(
    tools.map(async (tool, index) => {
      if (tool.action === "list_files") {
        return `[${index + 1}] ${await executeListFiles(sandbox, tool)}`;
      } else {
        return `[${index + 1}] ${await executeReadFile(sandbox, tool)}`;
      }
    })
  );
  return `Results for parallel read:\n${results.join("\n")}`;
}

// Bash command execution function
async function executeBashCommand(
  sandbox: any,
  tool: BashTool
): Promise<string> {
  try {
    const timeout = tool.timeout || 120000; // Default 2 minutes, max 10 minutes
    const maxTimeout = Math.min(timeout, 600000);
    
    console.log(`[generate-code-stream] Executing bash command: ${tool.command} (timeout: ${maxTimeout}ms)`);
    
    // Execute command using bash -c in the sandbox
    const process = await sandbox.exec(["bash", "-c", tool.command]);
    
    // Read stdout and stderr
    const stdoutPromise = process.stdout.readText();
    const stderrPromise = process.stderr.readText();
    
    // Wait for process to complete with timeout
    const waitPromise = process.wait();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Command timed out")), maxTimeout)
    );
    
    const exitCode = await Promise.race([waitPromise, timeoutPromise]);
    
    const stdout = await stdoutPromise;
    const stderr = await stderrPromise;
    
    // Combine stdout and stderr, truncate if too long
    let output = "";
    if (stdout) output += stdout;
    if (stderr) {
      if (output) output += "\n";
      output += `STDERR: ${stderr}`;
    }
    
    // Truncate if output exceeds 30000 characters
    if (output.length > 30000) {
      output = output.substring(0, 30000) + "\n... (output truncated)";
    }
    
    if (exitCode === 0) {
      return `Command executed successfully:\n${output || "(no output)"}`;
    } else {
      return `Command exited with code ${exitCode}:\n${output || "(no output)"}`;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return `Error executing bash command: ${errorMessage}. Please check the command syntax and try again.`;
  }
}

// Helper function to extract all written files from message state
function extractFilesFromState(state: Message[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const msg of state) {
    if (
      msg.role === "assistant" &&
      typeof msg.message !== "string" &&
      "action" in msg.message &&
      msg.message.action === "write_file"
    ) {
      files[msg.message.filePath] = msg.message.content;
    }
  }
  return files;
}

// Todo management function
async function executeTodoWrite(
  tool: TodoWriteTool,
  todoList: TodoItem[]
): Promise<{ result: string; updatedList: TodoItem[] }> {
  const updatedList = tool.todos;
  // Validate that exactly one task is in_progress
  const inProgressCount = updatedList.filter((todo) => todo.status === "in_progress").length;
  let result = `Todo list updated. ${updatedList.length} items.`;
  if (inProgressCount !== 1 && updatedList.some((todo) => todo.status !== "completed")) {
    result += ` Warning: Expected exactly one task in_progress, found ${inProgressCount}.`;
  }
  return {
    result,
    updatedList,
  };
}

function areAllTodosCompleted(todoList: TodoItem[]): boolean {
  return todoList.length > 0 && todoList.every((todo) => todo.status === "completed");
}

// Retry wrapper for CodingAgent with exponential backoff for validation errors
async function callCodingAgentWithRetry(
  state: Message[],
  workingDir: string,
  todoList: TodoItem[],
  collector: Collector,
  maxRetries: number = 3
): Promise<FileTools | ParallelReadTools | TodoTools | ReplyToUser> {
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
        const tool = response as FileTools | ParallelReadTools | TodoTools;
        let toolName: string = tool.action;
        let currentTodo: string | undefined = undefined;

        if (tool.action === "parallel_read") {
          toolName = `parallel_read (${(tool as ParallelReadTools).tools.length} files)`;
        } else if (tool.action === "todo_write") {
          // Get the in-progress todo for progress display
          const updatedTodos = (tool as TodoWriteTool).todos;
          const inProgressTodo = updatedTodos.find(t => t.status === "in_progress");
          if (inProgressTodo) {
            currentTodo = inProgressTodo.content;
          }
        } else if (tool.action === "write_file") {
          currentTodo = `Writing ${(tool as WriteFileTool).filePath}`;
        }

        await sendProgress({
          type: 'coding_iteration',
          iteration: iterations,
          tool: toolName,
          todo: currentTodo,
        });

        let result: string;
        if (tool.action === "parallel_read") {
          console.log(`[generate-code-stream] Executing parallel_read with ${tool.tools.length} tools...`);
          result = await executeParallelReads(sandbox, tool.tools);
        } else if (tool.action === "list_files") {
          console.log("[generate-code-stream] Executing list_files tool...");
          result = await executeListFiles(sandbox, tool);
        } else if (tool.action === "read_file") {
          console.log("[generate-code-stream] Executing read_file tool...");
          result = await executeReadFile(sandbox, tool);
        } else if (tool.action === "write_file") {
          console.log("[generate-code-stream] Executing write_file tool...");
          result = await executeWriteFile(sandbox, tool, workingDir);
          if (!result.startsWith("Error")) {
            modifiedFiles[tool.filePath] = tool.content;
          }
        } else if (tool.action === "todo_write") {
          console.log("[generate-code-stream] Executing todo_write tool...");
          const writeResult = await executeTodoWrite(tool, todoList);
          console.log("[generate-code-stream] Todo write result:", writeResult);
          console.log("[generate-code-stream] Todo write result:", writeResult.updatedList);
          result = writeResult.result;
          todoList = writeResult.updatedList;
          
          // Send todo update event
          await sendProgress({
            type: 'todo_update',
            todos: todoList,
          });
          
          // Check if all todos are completed
          if (areAllTodosCompleted(todoList)) {
            console.log("[generate-code-stream] All todos completed, agent should reply to user");
          }
        } else if (tool.action === "bash") {
          console.log("[generate-code-stream] Executing bash tool...");
          result = await executeBashCommand(sandbox, tool);
        } else {
          result = `Unknown tool action: ${(tool as FileTools | ParallelReadTools | TodoTools).action}`;
        }

        // Add tool execution to state
        state.push({
          role: "assistant",
          message: tool,
        });
        state.push({
          role: "user",
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

