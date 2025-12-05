/**
 * Coding Agent Orchestration
 * 
 * Handles the orchestration of the BAML coding agent, including:
 * - Retry logic for agent calls
 * - Tool execution loop
 * - Progress tracking and reporting
 */

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
  extractFilesFromState,
  areAllTodosCompleted,
  extractToolParams,
} from "@/lib/server/tool-executors";
import { WORKING_DIR, LOG_PREFIXES } from "@/lib/constants";
import type { SSEProgressEvent } from "@/types";
import { getAgentState, setAgentState } from "@/lib/server/agent-state-store";

// ============================================================================
// Types
// ============================================================================

/**
 * Progress callback for reporting agent progress
 */
export type ProgressCallback = (event: SSEProgressEvent) => Promise<void>;

/**
 * Configuration for running the coding agent
 */
export interface CodingAgentConfig {
  userPrompt: string;
  sandboxId: string;
  projectId: string;
  workingDir?: string;
  maxIterations?: number;
  maxRetries?: number;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

/**
 * Result of running the coding agent
 */
export interface CodingAgentResult {
  success: boolean;
  message?: string;
  files?: Record<string, string>;
  error?: string;
  details?: unknown;
  state?: Message[]; // Final agent state after completion
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Calls the CodingAgent with retry logic for validation errors
 */
async function callCodingAgentWithRetry(
  state: Message[],
  workingDir: string,
  todoList: TodoItem[],
  collector: Collector,
  maxRetries: number = 3
): Promise<FileTools | TodoTools | ReplyToUser> {
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
        console.log(`${LOG_PREFIXES.CHAT} CodingAgent succeeded on retry attempt ${attempt}`);
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
            `${LOG_PREFIXES.CHAT} CodingAgent validation error on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delayMs}ms...`
          );
          console.error(`${LOG_PREFIXES.CHAT} Validation error details:`, error.detailed_message || error.message);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          // All retries exhausted
          console.error(
            `${LOG_PREFIXES.CHAT} CodingAgent failed after ${maxRetries + 1} attempts with validation error`
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

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Formats an error for SSE streaming
 */
export function formatErrorForStream(
  error: unknown,
  context: string = ""
): SSEProgressEvent {
  const contextPrefix = context ? `${context} ` : "";
  let errorMessage = "Unknown error";
  let errorDetails: unknown = undefined;

  if (error instanceof BamlAbortError) {
    errorMessage = `${contextPrefix}operation was cancelled`;
    errorDetails = error.reason || error.message;
    console.error(`${LOG_PREFIXES.CHAT} ${errorMessage}:`, error.message);
    console.error(`${LOG_PREFIXES.CHAT} Cancellation reason:`, error.reason);
  } else if (error instanceof BamlValidationError || error instanceof BamlClientFinishReasonError) {
    errorMessage = `${contextPrefix}encountered a BAML error`;
    errorDetails = error.detailed_message || error.message;
    console.error(`${LOG_PREFIXES.CHAT} ${errorMessage}:`, error.message);
    console.error(`${LOG_PREFIXES.CHAT} BAML error detailed message:`, error.detailed_message);
    if (error.raw_output) {
      console.error(`${LOG_PREFIXES.CHAT} BAML error raw output:`, error.raw_output);
    }
  } else {
    errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("BamlError:")) {
      console.error(`${LOG_PREFIXES.CHAT} ${contextPrefix}BAML error:`, errorMessage);
    } else {
      console.error(`${LOG_PREFIXES.CHAT} ${contextPrefix}Error:`, errorMessage);
      if (error instanceof Error) {
        console.error(`${LOG_PREFIXES.CHAT} Error stack:`, error.stack);
        errorDetails = error.stack;
      }
    }
  }

  return {
    type: 'error',
    error: errorMessage,
    details: errorDetails,
  };
}

// ============================================================================
// Main Orchestration
// ============================================================================

/**
 * Runs the coding agent orchestration loop
 * 
 * This function handles the main loop of:
 * 1. Calling the coding agent
 * 2. Executing tools returned by the agent
 * 3. Updating state and reporting progress
 * 4. Continuing until the agent replies to the user
 */
export async function runCodingAgent(
  modal: ModalClient,
  config: CodingAgentConfig
): Promise<CodingAgentResult> {
  const {
    userPrompt,
    sandboxId,
    projectId,
    workingDir = WORKING_DIR,
    maxIterations = 50,
    maxRetries = 3,
    onProgress,
    signal,
  } = config;

  // Validate input
  if (!userPrompt || !sandboxId) {
    const error = 'userPrompt and sandboxId are required';
    if (onProgress) {
      await onProgress({
        type: 'error',
        error,
      });
    }
    return { success: false, error };
  }

  // Validate Anthropic API key (required by BAML)
  if (!process.env.ANTHROPIC_API_KEY) {
    const error = 'ANTHROPIC_API_KEY environment variable is not configured';
    if (onProgress) {
      await onProgress({
        type: 'error',
        error,
      });
    }
    return { success: false, error };
  }

  if (onProgress) {
    await onProgress({ type: 'status', message: 'Initializing sandbox connection...' });
  }

  // Get the sandbox reference
  console.log(`${LOG_PREFIXES.CHAT} Getting sandbox reference...`);
  const sandbox = await modal.sandboxes.fromId(sandboxId);
  console.log(`${LOG_PREFIXES.CHAT} Sandbox reference obtained:`, sandbox.sandboxId);

  const modifiedFiles: Record<string, string> = {};

  // ============================================
  // CODING AGENT
  // ============================================
  console.log(`${LOG_PREFIXES.CHAT} Starting code generation...`);
  if (onProgress) {
    await onProgress({ type: 'status', message: 'Starting code generation...' });
  }
  
  // Create collector to track token usage and latency
  const collector = new Collector("code-generation");
  
  // Initialize empty todo list - the coding agent will create todos using todo_write
  let todoList: TodoItem[] = [];

  // Load previous state from storage, or start fresh
  let state: Message[] = getAgentState(projectId) || [];
  
  // Append the new user message to the state
  state.push({
    role: "user",
    message: userPrompt,
  });
  
  if (state.length > 1) {
    console.log(`${LOG_PREFIXES.CHAT} Using previous agent state with ${state.length - 1} previous messages`);
  } else {
    console.log(`${LOG_PREFIXES.CHAT} Starting fresh conversation`);
  }

  let iterations = 0;

  while (iterations < maxIterations) {
    // Check if request was aborted before starting next iteration
    if (signal?.aborted) {
      console.log(`${LOG_PREFIXES.CHAT} Coding agent stopped by user request`);
      
      // Save current state before stopping
      setAgentState(projectId, state);
      console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages before stopping`);
      
      if (onProgress) {
        await onProgress({
          type: 'stopped',
          message: 'Processing stopped by user',
        });
      }
      
      return {
        success: false,
        error: 'Processing stopped by user',
        state: state,
      };
    }
    
    iterations++;
    console.log(`${LOG_PREFIXES.CHAT} Iteration ${iterations}/${maxIterations}`);

    let response;
    try {
      response = await callCodingAgentWithRetry(
        state,
        workingDir,
        todoList,
        collector,
        maxRetries
      );
      
      // Log token usage and latency for this iteration
      if (collector.last) {
        console.log(`${LOG_PREFIXES.CHAT} CodingAgent iteration ${iterations} usage:`, {
          inputTokens: collector.last.usage?.inputTokens ?? null,
          outputTokens: collector.last.usage?.outputTokens ?? null,
          durationMs: collector.last.timing?.durationMs ?? null,
        });
      }
    } catch (error) {
      const errorEvent = formatErrorForStream(error, "Coding agent");
      if (onProgress) {
        await onProgress(errorEvent);
      }
      return {
        success: false,
        error: errorEvent.error,
        details: errorEvent.details,
      };
    }

    // Check if coding agent is replying (done)
    if (response && "action" in response && response.action === "reply_to_user") {
      // Extract all modified files
      const allFiles =
        Object.keys(modifiedFiles).length > 0
          ? modifiedFiles
          : extractFilesFromState(state);

      const replyMessage = "message" in response ? response.message : "";
      console.log(`${LOG_PREFIXES.CHAT} Coding agent completed with reply:`, replyMessage);
      
      // Add the final reply to state
      state.push({
        role: "assistant",
        message: replyMessage,
      });
      
      // Save the final state to storage
      setAgentState(projectId, state);
      console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages`);
      
      // Log cumulative token usage and latency
      console.log(`${LOG_PREFIXES.CHAT} CodingAgent complete - cumulative usage:`, {
        totalInputTokens: collector.usage?.inputTokens ?? null,
        totalOutputTokens: collector.usage?.outputTokens ?? null,
        totalCalls: collector.logs.length,
      });
      
      if (onProgress) {
        await onProgress({
          type: 'complete',
          message: replyMessage,
          files: allFiles,
        });
      }
      
      return {
        success: true,
        message: replyMessage,
        files: allFiles,
        state: state,
      };
    }

    // Execute the tool
    const tool = response as FileTools | TodoTools;
    let toolName: string;
    let currentTodo: string | undefined = undefined;

    if (tool.action === "todo_write") {
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
    } else if (tool.action === "list_files") {
      toolName = tool.action;
      currentTodo = `Listing ${(tool as ListFilesTool).directoryPath}`;
    } else if (tool.action === "verify_expo_server") {
      toolName = tool.action;
      currentTodo = "Verifying Expo server status";
    } else {
      toolName = tool.action;
    }

    // Log tool parameters (excluding content for WriteFileTool)
    console.log(`${LOG_PREFIXES.CHAT} Tool call parameters:`, extractToolParams(tool));

    if (onProgress) {
      await onProgress({
        type: 'coding_iteration',
        iteration: iterations,
        tool: toolName,
        todo: currentTodo,
      });
    }

    console.log(`${LOG_PREFIXES.CHAT} Executing ${tool.action} tool...`);
    const execResult = await executeSingleTool(sandbox, tool, workingDir, todoList);
    const result = execResult.result;
    
    // Check if request was aborted after tool execution (before next iteration)
    if (signal?.aborted) {
      console.log(`${LOG_PREFIXES.CHAT} Coding agent stopped by user request after tool execution`);
      
      // Save current state before stopping
      setAgentState(projectId, state);
      console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages before stopping`);
      
      if (onProgress) {
        await onProgress({
          type: 'stopped',
          message: 'Processing stopped by user',
        });
      }
      
      return {
        success: false,
        error: 'Processing stopped by user',
        state: state,
      };
    }
    
    // Handle side effects
    if (tool.action === "write_file" && !result.startsWith("Error")) {
      modifiedFiles[tool.filePath] = tool.content;
    } else if (tool.action === "todo_write" && execResult.updatedTodoList) {
      todoList = execResult.updatedTodoList;
      console.log(`${LOG_PREFIXES.CHAT} Todo write result:`, execResult.result);
      console.log(`${LOG_PREFIXES.CHAT} Todo list updated:`, execResult.updatedTodoList);
      
      // Send todo update event
      if (onProgress) {
        await onProgress({
          type: 'todo_update',
          todos: todoList.map(t => ({
            content: t.content,
            activeForm: t.activeForm || "",
            status: t.status,
          })),
        });
      }
      
      // Check if all todos are completed
      if (areAllTodosCompleted(todoList)) {
        console.log(`${LOG_PREFIXES.CHAT} All todos completed, agent should reply to user`);
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
  console.error(`${LOG_PREFIXES.CHAT} Coding agent exceeded maximum iterations`);
  const error = 'Coding agent exceeded maximum iterations. Please try again with a simpler request.';
  
  // Save current state even on error (so user can continue from where it failed)
  setAgentState(projectId, state);
  
  if (onProgress) {
    await onProgress({
      type: 'error',
      error,
    });
  }
  return { success: false, error, state: state };
}

