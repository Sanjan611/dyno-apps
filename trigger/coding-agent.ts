/**
 * Trigger.dev Coding Agent Task
 *
 * This task runs the coding agent in Trigger.dev's infrastructure,
 * eliminating Vercel's 5-minute timeout limitation.
 *
 * Progress is communicated via Trigger.dev's metadata system,
 * which can be consumed by the frontend using useRealtimeRun().
 */

import { task, metadata } from "@trigger.dev/sdk/v3";
import { ModalClient } from "modal";
import { b } from "@/baml_client";
import {
  BamlValidationError,
  BamlClientFinishReasonError,
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
import { getAgentState, setAgentState } from "@/lib/server/agent-state-store";
import { withRetry } from "@/lib/server/retry-utils";
import { extractBamlMetrics } from "@/lib/server/coding-agent";
import { recordTokenUsageBatch, TokenUsageRecord } from "@/lib/server/clickhouse";

// ============================================================================
// Types
// ============================================================================

/**
 * Payload for the coding agent task
 */
export interface CodingAgentPayload {
  projectId: string;
  sandboxId: string;
  userPrompt: string;
  userId: string;
  workingDir?: string;
  maxIterations?: number;
}

/**
 * Result returned by the coding agent task
 */
export interface CodingAgentTaskResult {
  success: boolean;
  message?: string;
  files?: Record<string, string>;
  error?: string;
  iterations?: number;
}

/**
 * Metadata for real-time updates (updated during task execution)
 * This is consumed by the frontend via useRealtimeRun()
 */
export interface AgentMetadata {
  status:
    | "starting"
    | "thinking"
    | "executing_tool"
    | "complete"
    | "error"
    | "stopped";
  iteration: number;
  maxIterations: number;
  currentTool?: string;
  toolDescription?: string;
  todos?: Array<{ content: string; activeForm: string; status: string }>;
  modifiedFiles?: string[];
  statusMessage?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a configured Modal client instance
 */
function createModalClient(): ModalClient {
  const tokenId = process.env.MODAL_TOKEN_ID;
  const tokenSecret = process.env.MODAL_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error(
      "Modal credentials not configured. Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET in environment variables."
    );
  }

  return new ModalClient({
    tokenId,
    tokenSecret,
  });
}

/**
 * Calls the CodingAgent with retry logic for validation errors
 */
async function callCodingAgentWithRetry(
  state: Message[],
  workingDir: string,
  todoList: TodoItem[],
  collector: Collector,
  userId: string,
  maxRetries: number = 3
): Promise<AgentTools | ReplyToUser | ReadFilesTool> {
  return withRetry(
    () =>
      b.CodingAgent(state, workingDir, todoList, {
        collector,
        tags: { userId },
      }),
    maxRetries,
    [BamlValidationError, BamlClientFinishReasonError],
    LOG_PREFIXES.CHAT + " CodingAgent"
  );
}

/**
 * Get description for a tool action
 */
function getToolDescription(
  tool: FileTools | TodoTools | ReadFilesTool
): string {
  switch (tool.action) {
    case "write_file":
      return `Writing ${(tool as WriteFileTool).filePath}`;
    case "read_file":
      return `Reading ${(tool as ReadFileTool).filePath}`;
    case "read_files": {
      const readFilesTool = tool as ReadFilesTool;
      const fileCount = readFilesTool.tools.length;
      return `Reading ${fileCount} file${fileCount !== 1 ? "s" : ""}`;
    }
    case "list_files":
      return `Listing ${(tool as ListFilesTool).directoryPath}`;
    case "edit_file":
      return `Editing ${(tool as EditTool).filePath}`;
    case "verify_expo_server":
      return "Verifying Expo server status";
    case "todo_write": {
      const todoTool = tool as TodoWriteTool;
      const inProgressTodo = todoTool.todos.find(
        (t) => t.status === "in_progress"
      );
      return inProgressTodo?.content || "Updating todo list";
    }
    default:
      return `Executing ${tool.action}`;
  }
}

// ============================================================================
// Trigger.dev Task Definition
// ============================================================================

export const codingAgentTask = task({
  id: "coding-agent",

  run: async (payload: CodingAgentPayload): Promise<CodingAgentTaskResult> => {
    const {
      projectId,
      sandboxId,
      userPrompt,
      userId,
      workingDir = REPO_DIR,
      maxIterations = 50,
    } = payload;

    // Initialize metadata for real-time updates
    await metadata.set("status", "starting");
    await metadata.set("iteration", 0);
    await metadata.set("maxIterations", maxIterations);
    await metadata.set("statusMessage", "Initializing sandbox connection...");

    // Validate input
    if (!userPrompt || !sandboxId) {
      await metadata.set("status", "error");
      await metadata.set("statusMessage", "userPrompt and sandboxId are required");
      return {
        success: false,
        error: "userPrompt and sandboxId are required",
      };
    }

    // Initialize Modal client
    console.log(`${LOG_PREFIXES.CHAT} Getting sandbox reference...`);
    const modal = createModalClient();
    const sandbox = await modal.sandboxes.fromId(sandboxId);
    console.log(
      `${LOG_PREFIXES.CHAT} Sandbox reference obtained:`,
      sandbox.sandboxId
    );

    const modifiedFiles: Record<string, string> = {};
    const modifiedFilePaths: string[] = [];

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
      console.log(
        `${LOG_PREFIXES.CHAT} Using previous agent state with ${state.length - 1} previous messages`
      );
    } else {
      console.log(`${LOG_PREFIXES.CHAT} Starting fresh conversation`);
    }

    await metadata.set("statusMessage", "Starting code generation...");

    let iterations = 0;

    // Wrap in try-finally to ensure metrics are always sent, even on cancellation
    try {
      while (iterations < maxIterations) {
        iterations++;
        console.log(`${LOG_PREFIXES.CHAT} Iteration ${iterations}/${maxIterations}`);

        // Update metadata for thinking phase
        await metadata.set("iteration", iterations);
        await metadata.set("status", "thinking");
        await metadata.set("statusMessage", `Iteration ${iterations}/${maxIterations}`);

        let response;
        try {
          response = await callCodingAgentWithRetry(
            state,
            workingDir,
            todoList,
            collector,
            userId,
            3
          );

          // Log token usage and latency for this iteration
          if (collector.last) {
            const metrics = extractBamlMetrics(collector, false);
            console.log(`${LOG_PREFIXES.CHAT} CodingAgent iteration ${iterations} usage:`, metrics);

            // Accumulate for batch insert to ClickHouse
            tokenUsageRecords.push({
              userId,
              projectId,
              iteration: iterations,
              inputTokens: metrics.inputTokens ?? 0,
              outputTokens: metrics.outputTokens ?? 0,
              cachedInputTokens: metrics.cachedInputTokens ?? 0,
              model: metrics.model ?? "unknown",
            });
          }
        } catch (error) {
          // Handle errors
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`${LOG_PREFIXES.CHAT} CodingAgent error:`, errorMessage);

          // Save state before erroring
          await setAgentState(projectId, state);

          await metadata.set("status", "error");
          await metadata.set("statusMessage", errorMessage);

          return {
            success: false,
            error: errorMessage,
            iterations,
          };
        }

        // Check if coding agent is replying (done)
        if (
          response &&
          "action" in response &&
          response.action === "reply_to_user"
        ) {
          // Extract all modified files
          const allFiles =
            Object.keys(modifiedFiles).length > 0
              ? modifiedFiles
              : extractFilesFromState(state);

          const replyMessage = "message" in response ? response.message : "";
          console.log(
            `${LOG_PREFIXES.CHAT} Coding agent completed with reply:`,
            replyMessage
          );

          // Add the final reply to state
          state.push({
            role: "assistant",
            message: response,
          });

          // Save the final state to storage
          await setAgentState(projectId, state);
          console.log(
            `${LOG_PREFIXES.CHAT} Saved agent state with ${state.length} messages`
          );

          // Update metadata to complete
          await metadata.set("status", "complete");
          await metadata.set("statusMessage", replyMessage);
          await metadata.set("modifiedFiles", Object.keys(allFiles));

          return {
            success: true,
            message: replyMessage,
            files: allFiles,
            iterations,
          };
        }

        // Execute the tool
        const tool = response as FileTools | TodoTools | ReadFilesTool;
        const toolDescription = getToolDescription(tool);

        // Update metadata for tool execution
        await metadata.set("status", "executing_tool");
        await metadata.set("currentTool", tool.action);
        await metadata.set("toolDescription", toolDescription);

        // Log tool parameters (excluding content for WriteFileTool)
        console.log(
          `${LOG_PREFIXES.CHAT} Tool call parameters:`,
          extractToolParams(tool)
        );

        console.log(`${LOG_PREFIXES.CHAT} Executing ${tool.action} tool...`);
        const execResult = await executeSingleTool(
          sandbox,
          tool,
          workingDir,
          todoList
        );
        const result = execResult.result;

        // Handle side effects
        if (tool.action === "write_file" && !result.startsWith("Error")) {
          const writeTool = tool as WriteFileTool;
          modifiedFiles[writeTool.filePath] = writeTool.content;
          modifiedFilePaths.push(writeTool.filePath);
          await metadata.set("modifiedFiles", modifiedFilePaths);
        } else if (tool.action === "todo_write" && execResult.updatedTodoList) {
          todoList = execResult.updatedTodoList;
          console.log(`${LOG_PREFIXES.CHAT} Todo list updated:`, todoList);

          // Update metadata with todos
          await metadata.set(
            "todos",
            todoList.map((t) => ({
              content: t.content,
              activeForm: t.activeForm || "",
              status: t.status,
            }))
          );

          // Check if all todos are completed
          if (areAllTodosCompleted(todoList)) {
            console.log(
              `${LOG_PREFIXES.CHAT} All todos completed, agent should reply to user`
            );
          }
        }

        // Add tool execution to state
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
      console.error(
        `${LOG_PREFIXES.CHAT} Coding agent exceeded maximum iterations`
      );
      const error =
        "Coding agent exceeded maximum iterations. Please try again with a simpler request.";

      // Save current state even on error
      await setAgentState(projectId, state);

      await metadata.set("status", "error");
      await metadata.set("statusMessage", error);

      return {
        success: false,
        error,
        iterations: maxIterations,
      };
    } finally {
      // Always send token usage to ClickHouse, even on cancellation
      console.log(`${LOG_PREFIXES.CHAT} Sending ${tokenUsageRecords.length} token usage records to ClickHouse...`);
      await recordTokenUsageBatch(tokenUsageRecords);
    }
  },
});
