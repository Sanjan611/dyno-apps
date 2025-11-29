import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";
import { dirname } from "path";
import { b } from "@/baml_client";
import {
  BamlValidationError,
  BamlClientFinishReasonError,
  BamlAbortError,
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
  Plan,
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

async function executeWriteFile(
  sandbox: any,
  tool: WriteFileTool
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
    return `Successfully wrote file ${tool.filePath}`;
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
      console.error(`[generate-code-stream] BAML error prompt:`, error.prompt);
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
      // PHASE 1: PLANNING AGENT
      // ============================================
      console.log("[generate-code-stream] Starting planning phase...");
      await sendProgress({ type: 'status', message: 'Planning phase started...' });

      const planningState: Message[] = [
        {
          role: "user",
          message: userPrompt,
        },
      ];

      let plan: Plan | null = null;
      let planIterations = 0;

      while (planIterations < maxIterations) {
        planIterations++;
        console.log(`[generate-code-stream] Planning iteration ${planIterations}/${maxIterations}`);

        // Start keepalive interval during long LLM calls
        const keepaliveInterval = setInterval(() => {
          sendKeepalive();
        }, 15000); // Send keepalive every 15 seconds

        let planningResponse;
        try {
          planningResponse = await b.PlanningAgent(planningState, workingDir);
        } catch (e) {
          clearInterval(keepaliveInterval);
          sendErrorViaStream(writer, encoder, e, "Planning agent");
          await writer.close();
          return;
        } finally {
          clearInterval(keepaliveInterval);
        }

        // Check if planning agent has output a plan
        if (planningResponse && "summary" in planningResponse && "steps" in planningResponse) {
          plan = planningResponse as Plan;
          console.log("[generate-code-stream] Planning complete:", plan.summary);
          
          await sendProgress({
            type: 'plan_complete',
            plan: {
              summary: plan.summary,
              steps: plan.steps,
            },
          });
          break;
        }

        // Execute read-only tools (single or parallel)
        const tool = planningResponse as ReadOnlyTools | ParallelReadTools;
        let toolName = tool.action;
        if (tool.action === "parallel_read") {
          toolName = `parallel_read (${(tool as ParallelReadTools).tools.length} files)`;
        }
        
        await sendProgress({
          type: 'planning_iteration',
          iteration: planIterations,
          tool: toolName,
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
        } else {
          result = `Unknown tool action: ${(tool as ReadOnlyTools | ParallelReadTools).action}`;
        }

        // Add tool execution to state
        planningState.push({
          role: "assistant",
          message: tool,
        });
        planningState.push({
          role: "user",
          message: result,
        });
      }

      if (!plan) {
        console.error("[generate-code-stream] Planning agent exceeded maximum iterations");
        await sendProgress({
          type: 'error',
          error: 'Planning agent exceeded maximum iterations. Please try again with a simpler request.',
        });
        await writer.close();
        return;
      }

      // Create planning message for user
      const planningMessage = `I've analyzed your request and created a plan to implement your changes. The plan includes ${plan.steps.length} steps.`;

      // ============================================
      // PHASE 2: CODING AGENT
      // ============================================
      console.log("[generate-code-stream] Starting coding phase...");
      await sendProgress({ type: 'status', message: 'Coding phase started...' });
      
      // Initialize empty todo list - the coding agent will create todos using todo_write
      // This aligns with Claude Code's approach where the agent manages the todo list
      let todoList: TodoItem[] = [];

      const codingState: Message[] = [
        {
          role: "user",
          message: userPrompt,
        },
      ];

      let codingIterations = 0;

      while (codingIterations < maxIterations) {
        codingIterations++;
        console.log(`[generate-code-stream] Coding iteration ${codingIterations}/${maxIterations}`);

        // Start keepalive interval during long LLM calls
        const keepaliveInterval = setInterval(() => {
          sendKeepalive();
        }, 15000); // Send keepalive every 15 seconds

        let codingResponse;
        try {
          codingResponse = await b.CodingAgent(
            codingState,
            workingDir,
            plan,
            todoList
          );
        } catch (e) {
          clearInterval(keepaliveInterval);
          sendErrorViaStream(writer, encoder, e, "Coding agent");
          await writer.close();
          return;
        } finally {
          clearInterval(keepaliveInterval);
        }

        // Check if coding agent is replying (done)
        if (codingResponse && "action" in codingResponse && codingResponse.action === "reply_to_user") {
          // Extract all modified files
          const allFiles =
            Object.keys(modifiedFiles).length > 0
              ? modifiedFiles
              : extractFilesFromState(codingState);

          const replyMessage = "message" in codingResponse ? codingResponse.message : "";
          console.log("[generate-code-stream] Coding agent completed with reply:", replyMessage);
          
          await sendProgress({
            type: 'complete',
            message: replyMessage,
            files: allFiles,
            planningMessage: planningMessage,
            plan: {
              summary: plan.summary,
              steps: plan.steps,
            },
          });
          
          await writer.close();
          return;
        }

        // Execute the tool (single or parallel)
        const tool = codingResponse as FileTools | ParallelReadTools | TodoTools;
        let toolName = tool.action;
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
          iteration: codingIterations,
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
          result = await executeWriteFile(sandbox, tool);
          if (!result.startsWith("Error")) {
            modifiedFiles[tool.filePath] = tool.content;
          }
        } else if (tool.action === "todo_write") {
          console.log("[generate-code-stream] Executing todo_write tool...");
          const writeResult = await executeTodoWrite(tool, todoList);
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
        codingState.push({
          role: "assistant",
          message: tool,
        });
        codingState.push({
          role: "user",
          message: result,
        });
      }

      // Handle timeout if coding loop exceeds max iterations
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

