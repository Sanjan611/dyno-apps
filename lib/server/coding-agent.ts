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
  ReadFilesTool,
  WriteFileTool,
  EditTool,
  Message,
  ReplyToUser,
  FileTools,
  TodoItem,
  TodoWriteTool,
  TodoTools,
  AgentTools,
} from "@/baml_client/types";
import {
  executeSingleTool,
  extractFilesFromState,
  areAllTodosCompleted,
  extractToolParams,
} from "@/lib/server/tool-executors";
import { REPO_DIR, LOG_PREFIXES } from "@/lib/constants";
import type { SSEProgressEvent } from "@/types";
import { getAgentState, setAgentState } from "@/lib/server/agent-state-store";
import { withRetry } from "@/lib/server/retry-utils";
import { recordTokenUsageBatch, TokenUsageRecord } from "@/lib/server/clickhouse";
import { calculateCost } from "@/lib/server/pricingStore";
import { deductCredits } from "@/lib/server/creditsStore";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Records token usage to ClickHouse and deducts credits from user's balance
 */
async function recordUsageAndDeductCredits(
  tokenUsageRecords: TokenUsageRecord[],
  userId: string,
  projectId: string
): Promise<void> {
  // Record token usage to ClickHouse
  await recordTokenUsageBatch(tokenUsageRecords);

  // Calculate total raw cost from this run and deduct credits
  const totalRawCost = tokenUsageRecords.reduce((sum, r) => sum + r.costUsd, 0);
  if (totalRawCost > 0) {
    await deductCredits(userId, totalRawCost, projectId);
  }
}

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
  userId: string;
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
// BAML Metrics Extraction
// ============================================================================

/**
 * Metrics extracted from BAML Collector for logging
 */
interface BamlMetrics {
  clientName?: string | null;
  provider?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  durationMs?: number | null;
}

interface CumulativeBamlMetrics extends BamlMetrics {
  totalCalls: number;
}

/**
 * Extracts BAML metrics from a Collector for logging
 */
export function extractBamlMetrics(collector: Collector, isCumulative: boolean = false): BamlMetrics | CumulativeBamlMetrics {
  if (isCumulative) {
    return {
      clientName: null, // Not applicable for cumulative
      provider: null, // Not applicable for cumulative
      model: null, // Not applicable for cumulative
      inputTokens: collector.usage?.inputTokens ?? null,
      outputTokens: collector.usage?.outputTokens ?? null,
      cachedInputTokens: collector.usage?.cachedInputTokens ?? null,
      durationMs: null, // Not aggregated in cumulative
      totalCalls: collector.logs.length,
    };
  }

  if (!collector.last) {
    return {
      clientName: null,
      provider: null,
      model: null,
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
      durationMs: null,
    };
  }

  // Get client info from the calls array (per BAML docs: LLMCall has clientName and provider)
  // Only use the selected call for metrics
  let clientName: string | null = null;
  let provider: string | null = null;
  let model: string | null = null;

  if (collector.last.calls && collector.last.calls.length > 0) {
    // Find the selected call (the one that was actually used)
    const selectedCall = collector.last.calls.find((call: any) => call.selected === true);

    if (selectedCall) {
      clientName = selectedCall.clientName ?? null;
      provider = selectedCall.provider ?? null;

      // Extract model from HTTP request body (where LLM APIs expect it)
      try {
        const requestBody = selectedCall.httpRequest?.body?.json();
        if (requestBody && typeof requestBody.model === "string") {
          model = requestBody.model;
        }
      } catch {
        // Ignore JSON parsing errors
      }
    }
  }

  return {
    clientName,
    provider,
    model,
    inputTokens: collector.last.usage?.inputTokens ?? null,
    outputTokens: collector.last.usage?.outputTokens ?? null,
    cachedInputTokens: collector.last.usage?.cachedInputTokens ?? null,
    durationMs: collector.last.timing?.durationMs ?? null,
  };
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
  userId: string,
  maxRetries: number = 3,
  signal?: AbortSignal
): Promise<AgentTools | ReplyToUser | ReadFilesTool> {
  return withRetry(
    () => b.CodingAgent(state, workingDir, todoList, { collector, signal, tags: { userId } }),
    maxRetries,
    [BamlValidationError, BamlClientFinishReasonError],
    LOG_PREFIXES.CHAT + ' CodingAgent'
  );
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
    // User-friendly message for BAML errors - don't expose technical details
    errorMessage = "An error occurred while processing your request. Please try again.";
    errorDetails = error.detailed_message || error.message;
    console.error(`${LOG_PREFIXES.CHAT} BAML error:`, error.message);
    console.error(`${LOG_PREFIXES.CHAT} BAML error detailed message:`, error.detailed_message);
    if (error.raw_output) {
      console.error(`${LOG_PREFIXES.CHAT} BAML error raw output:`, error.raw_output);
    }
  } else {
    const rawMessage = error instanceof Error ? error.message : String(error);

    // Check if this looks like a technical error that shouldn't be shown to users
    const technicalPatterns = [
      /BamlError/i,
      /Failed to parse/i,
      /Failed to coerce/i,
      /ParsingError/i,
    ];

    const isTechnicalError = technicalPatterns.some(pattern => pattern.test(rawMessage));

    if (isTechnicalError) {
      errorMessage = "An error occurred while processing your request. Please try again.";
      console.error(`${LOG_PREFIXES.CHAT} ${contextPrefix}Technical error:`, rawMessage);
    } else {
      errorMessage = rawMessage;
      console.error(`${LOG_PREFIXES.CHAT} ${contextPrefix}Error:`, rawMessage);
    }

    if (error instanceof Error) {
      console.error(`${LOG_PREFIXES.CHAT} Error stack:`, error.stack);
      errorDetails = error.stack;
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
    userId,
    workingDir = REPO_DIR,
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
    // Send agent_started event to show thinking box immediately
    await onProgress({ type: 'agent_started', message: 'Analyzing your request...' });
  }

  // Create collector to track token usage and latency
  const collector = new Collector("code-generation");

  // Initialize array for token usage records (batch inserted to ClickHouse at end)
  const tokenUsageRecords: TokenUsageRecord[] = [];

  // Initialize empty todo list - the coding agent will create todos using todo_write
  let todoList: TodoItem[] = [];

  // Load previous state from storage, or start fresh
  let state: Message[] = (await getAgentState(projectId)) || [];

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
      await setAgentState(projectId, state);
      console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages before stopping`);

      // Batch send partial token usage to ClickHouse
      await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

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
        userId,
        maxRetries,
        signal
      );
      
      // Log token usage and latency for this iteration
      if (collector.last) {
        const metrics = extractBamlMetrics(collector, false);
        console.log(`${LOG_PREFIXES.CHAT} CodingAgent iteration ${iterations} usage:`, metrics);

        // Calculate cost for this iteration
        const cost = await calculateCost(
          metrics.model ?? "unknown",
          metrics.inputTokens ?? 0,
          metrics.cachedInputTokens ?? 0,
          metrics.outputTokens ?? 0
        );

        // Accumulate for batch insert to ClickHouse
        tokenUsageRecords.push({
          userId,
          projectId,
          iteration: iterations,
          inputTokens: metrics.inputTokens ?? 0,
          outputTokens: metrics.outputTokens ?? 0,
          cachedInputTokens: metrics.cachedInputTokens ?? 0,
          model: metrics.model ?? "unknown",
          costUsd: cost,
        });
      }
    } catch (error) {
      // Handle BamlAbortError as a clean cancellation (not an error)
      if (error instanceof BamlAbortError) {
        console.log(`${LOG_PREFIXES.CHAT} Coding agent stopped by user request (BAML abort)`);

        // Save current state before stopping
        await setAgentState(projectId, state);
        console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages before stopping`);

        // Batch send partial token usage to ClickHouse
        await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

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

      // Handle other errors normally
      const errorEvent = formatErrorForStream(error, "Coding agent");

      // Batch send partial token usage to ClickHouse
      await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

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
      
      // Add the final reply to state (store full ReplyToUser object)
      state.push({
        role: "assistant",
        message: response,
      });
      
      // Save the final state to storage
      await setAgentState(projectId, state);
      console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages`);
      
      // Log cumulative token usage and latency
      const cumulativeMetrics = extractBamlMetrics(collector, true);
      console.log(`${LOG_PREFIXES.CHAT} CodingAgent complete - cumulative usage:`, cumulativeMetrics);

      // Batch send token usage to ClickHouse
      await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

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
    const tool = response as FileTools | TodoTools | ReadFilesTool;
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
    } else if (tool.action === "read_files") {
      toolName = tool.action;
      const readFilesTool = tool as ReadFilesTool;
      const fileCount = readFilesTool.tools.length;
      currentTodo = `Reading ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
    } else if (tool.action === "list_files") {
      toolName = tool.action;
      currentTodo = `Listing ${(tool as ListFilesTool).directoryPath}`;
    } else if (tool.action === "edit_file") {
      toolName = tool.action;
      currentTodo = `Editing ${(tool as EditTool).filePath}`;
    } else if (tool.action === "verify_expo_server") {
      toolName = tool.action;
      currentTodo = "Verifying app is running";
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
      await setAgentState(projectId, state);
      console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages before stopping`);

      // Batch send partial token usage to ClickHouse
      await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

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
    // Note: ReadFilesTool is part of FileTools (and thus AgentTools) after BAML regeneration
    state.push({
      role: "assistant",
      message: tool as AgentTools,
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
  await setAgentState(projectId, state);

  // Batch send partial token usage to ClickHouse
  await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

  if (onProgress) {
    await onProgress({
      type: 'error',
      error,
    });
  }
  return { success: false, error, state: state };
}

/**
 * Calls the AskAgent with retry logic for validation errors
 */
async function callAskAgentWithRetry(
  state: Message[],
  workingDir: string,
  collector: Collector,
  userId: string,
  maxRetries: number = 3,
  signal?: AbortSignal
): Promise<ListFilesTool | ReadFileTool | ReadFilesTool | ReplyToUser> {
  return withRetry(
    () => b.AskAgent(state, workingDir, { collector, signal, tags: { userId } }),
    maxRetries,
    [BamlValidationError, BamlClientFinishReasonError],
    LOG_PREFIXES.CHAT + ' AskAgent'
  );
}

/**
 * Runs the ask agent orchestration loop (read-only conversation mode)
 *
 * This function handles conversational mode where the agent:
 * 1. Explores the codebase with read-only tools
 * 2. Discusses and answers questions
 * 3. Helps plan features without implementing them
 * 4. Replies to the user when done
 */
export async function runAskAgent(
  modal: ModalClient,
  config: CodingAgentConfig
): Promise<CodingAgentResult> {
  const {
    userPrompt,
    sandboxId,
    projectId,
    userId,
    workingDir = REPO_DIR,
    maxIterations = 10,  // Lower max iterations for ask mode
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
    await onProgress({ type: 'status', message: 'Initializing conversation...' });
  }

  // Get the sandbox reference
  console.log(`${LOG_PREFIXES.CHAT} Getting sandbox reference for ask mode...`);
  const sandbox = await modal.sandboxes.fromId(sandboxId);
  console.log(`${LOG_PREFIXES.CHAT} Sandbox reference obtained:`, sandbox.sandboxId);

  // ============================================
  // ASK AGENT
  // ============================================
  console.log(`${LOG_PREFIXES.CHAT} Starting ask mode conversation...`);
  if (onProgress) {
    await onProgress({ type: 'status', message: 'Starting conversation...' });
    // Send agent_started event to show thinking box immediately
    await onProgress({ type: 'agent_started', message: 'Analyzing your request...' });
  }

  // Create collector to track token usage and latency
  const collector = new Collector("ask-mode");

  // Initialize array for token usage records (batch inserted to ClickHouse at end)
  const tokenUsageRecords: TokenUsageRecord[] = [];

  // Load previous state from storage, or start fresh
  let state: Message[] = (await getAgentState(projectId)) || [];

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
      console.log(`${LOG_PREFIXES.CHAT} Ask agent stopped by user request`);

      // Save current state before stopping
      await setAgentState(projectId, state);
      console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages before stopping`);

      // Batch send partial token usage to ClickHouse
      await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

      if (onProgress) {
        await onProgress({
          type: 'stopped',
          message: 'Conversation stopped by user',
        });
      }

      return {
        success: false,
        error: 'Conversation stopped by user',
        state: state,
      };
    }

    iterations++;
    console.log(`${LOG_PREFIXES.CHAT} Ask mode iteration ${iterations}/${maxIterations}`);

    let response;
    try {
      response = await callAskAgentWithRetry(
        state,
        workingDir,
        collector,
        userId,
        maxRetries,
        signal
      );

      // Log token usage and latency for this iteration
      if (collector.last) {
        const metrics = extractBamlMetrics(collector, false);
        console.log(`${LOG_PREFIXES.CHAT} AskAgent iteration ${iterations} usage:`, metrics);

        // Calculate cost for this iteration
        const cost = await calculateCost(
          metrics.model ?? "unknown",
          metrics.inputTokens ?? 0,
          metrics.cachedInputTokens ?? 0,
          metrics.outputTokens ?? 0
        );

        // Accumulate for batch insert to ClickHouse
        tokenUsageRecords.push({
          userId,
          projectId,
          iteration: iterations,
          inputTokens: metrics.inputTokens ?? 0,
          outputTokens: metrics.outputTokens ?? 0,
          cachedInputTokens: metrics.cachedInputTokens ?? 0,
          model: metrics.model ?? "unknown",
          costUsd: cost,
        });
      }
    } catch (error) {
      // Handle BamlAbortError as a clean cancellation (not an error)
      if (error instanceof BamlAbortError) {
        console.log(`${LOG_PREFIXES.CHAT} Ask agent stopped by user request (BAML abort)`);

        // Save current state before stopping
        await setAgentState(projectId, state);
        console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages before stopping`);

        // Batch send partial token usage to ClickHouse
        await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

        if (onProgress) {
          await onProgress({
            type: 'stopped',
            message: 'Conversation stopped by user',
          });
        }

        return {
          success: false,
          error: 'Conversation stopped by user',
          state: state,
        };
      }

      // Handle other errors normally
      const errorEvent = formatErrorForStream(error, "Ask agent");

      // Batch send partial token usage to ClickHouse
      await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

      if (onProgress) {
        await onProgress(errorEvent);
      }
      return {
        success: false,
        error: errorEvent.error,
        details: errorEvent.details,
      };
    }

    // Check if ask agent is replying (done)
    if (response && "action" in response && response.action === "reply_to_user") {
      const replyMessage = "message" in response ? response.message : "";
      console.log(`${LOG_PREFIXES.CHAT} Ask agent completed with reply:`, replyMessage);

      // Add the final reply to state (store full ReplyToUser object)
      state.push({
        role: "assistant",
        message: response,
      });

      // Save the final state to storage
      await setAgentState(projectId, state);
      console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages`);

      // Log cumulative token usage and latency
      const cumulativeMetrics = extractBamlMetrics(collector, true);
      console.log(`${LOG_PREFIXES.CHAT} AskAgent complete - cumulative usage:`, cumulativeMetrics);

      // Batch send token usage to ClickHouse
      await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

      if (onProgress) {
        await onProgress({
          type: 'complete',
          message: replyMessage,
        });
      }

      return {
        success: true,
        message: replyMessage,
        state: state,
      };
    }

    // Execute the tool (read-only: list_files, read_file, or read_files)
    const tool = response as ListFilesTool | ReadFileTool | ReadFilesTool;
    let toolName: string;
    let currentTodo: string | undefined = undefined;

    if ("filePath" in tool && tool.action === "read_file") {
      toolName = tool.action;
      currentTodo = `Reading ${tool.filePath}`;
    } else if (tool.action === "read_files") {
      toolName = tool.action;
      const readFilesTool = tool as ReadFilesTool;
      const fileCount = readFilesTool.tools.length;
      currentTodo = `Reading ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
    } else if ("directoryPath" in tool && tool.action === "list_files") {
      toolName = tool.action;
      currentTodo = `Listing ${tool.directoryPath}`;
    } else {
      toolName = (tool as any).action || "unknown";
    }

    // Log tool parameters
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
    const execResult = await executeSingleTool(sandbox, tool, workingDir, []);
    const result = execResult.result;

    // Check if request was aborted after tool execution (before next iteration)
    if (signal?.aborted) {
      console.log(`${LOG_PREFIXES.CHAT} Ask agent stopped by user request after tool execution`);

      // Save current state before stopping
      await setAgentState(projectId, state);
      console.log(`${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages before stopping`);

      // Batch send partial token usage to ClickHouse
      await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

      if (onProgress) {
        await onProgress({
          type: 'stopped',
          message: 'Conversation stopped by user',
        });
      }

      return {
        success: false,
        error: 'Conversation stopped by user',
        state: state,
      };
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
  console.error(`${LOG_PREFIXES.CHAT} Ask agent exceeded maximum iterations`);
  const error = 'Ask agent exceeded maximum iterations. Please try again with a simpler question.';

  // Save current state even on error (so user can continue from where it failed)
  await setAgentState(projectId, state);

  // Batch send partial token usage to ClickHouse
  await recordUsageAndDeductCredits(tokenUsageRecords, userId, projectId);

  if (onProgress) {
    await onProgress({
      type: 'error',
      error,
    });
  }
  return { success: false, error, state: state };
}

