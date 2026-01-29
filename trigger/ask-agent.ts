/**
 * Trigger.dev Ask Agent Task
 *
 * This task runs the ask agent in Trigger.dev's infrastructure,
 * eliminating Vercel's 5-minute timeout limitation.
 *
 * The ask agent is a read-only agent that explores the codebase
 * and discusses with users without making any changes.
 *
 * Progress is communicated via Trigger.dev's metadata system,
 * which can be consumed by the frontend using useRealtimeRun().
 */

import { task, metadata } from "@trigger.dev/sdk/v3";
import { ModalClient } from "modal";
import { b } from "../baml_client";
import {
  BamlValidationError,
  BamlClientFinishReasonError,
  Collector,
} from "@boundaryml/baml";
import type {
  ListFilesTool,
  ReadFileTool,
  ReadFilesTool,
  Message,
  ReplyToUser,
} from "../baml_client/types";
import {
  executeSingleTool,
  extractToolParams,
} from "../lib/server/tool-executors";
import { REPO_DIR, LOG_PREFIXES } from "../lib/constants";
import { getAgentState, setAgentState } from "../lib/server/agent-state-store";
import { withRetry } from "../lib/server/retry-utils";
import { extractBamlMetrics } from "../lib/server/coding-agent";
import { recordTokenUsageBatch, TokenUsageRecord } from "../lib/server/clickhouse";
import { calculateCost } from "../lib/server/pricingStore";
import { deductCredits } from "../lib/server/creditsStore";

// Re-export AgentMetadata from coding-agent for shared use
export type { AgentMetadata } from "./coding-agent";

// ============================================================================
// Types
// ============================================================================

/**
 * Payload for the ask agent task
 */
export interface AskAgentPayload {
  projectId: string;
  sandboxId: string;
  userPrompt: string;
  userId: string;
  workingDir?: string;
  maxIterations?: number;
}

/**
 * Result returned by the ask agent task
 * Simplified compared to coding agent - no files field (read-only)
 */
export interface AskAgentTaskResult {
  success: boolean;
  message?: string;
  error?: string;
  iterations?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats an error into a user-friendly message
 * Technical details are logged but not exposed to users
 */
function formatUserFriendlyError(error: unknown): string {
  // Log the full technical error for debugging
  console.error(`${LOG_PREFIXES.CHAT} Technical error details:`, error);

  // For BAML errors, return a generic user-friendly message
  if (error instanceof BamlValidationError || error instanceof BamlClientFinishReasonError) {
    return "An error occurred while processing your request. Please try again.";
  }

  // For other errors, check if they contain sensitive technical details
  const errorMessage = error instanceof Error ? error.message : String(error);

  // List of patterns that indicate technical errors that shouldn't be shown to users
  const technicalPatterns = [
    /BamlError/i,
    /Failed to parse/i,
    /Failed to coerce/i,
    /ParsingError/i,
    /ValidationError/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /socket hang up/i,
  ];

  for (const pattern of technicalPatterns) {
    if (pattern.test(errorMessage)) {
      return "An error occurred while processing your request. Please try again.";
    }
  }

  // For generic errors that are already user-friendly, return as-is
  return errorMessage;
}

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
 * Calls the AskAgent with retry logic for validation errors
 */
async function callAskAgentWithRetry(
  state: Message[],
  workingDir: string,
  collector: Collector,
  userId: string,
  maxRetries: number = 3
): Promise<ListFilesTool | ReadFileTool | ReadFilesTool | ReplyToUser> {
  return withRetry(
    () => b.AskAgent(state, workingDir, { collector, tags: { userId } }),
    maxRetries,
    [BamlValidationError, BamlClientFinishReasonError],
    LOG_PREFIXES.CHAT + " AskAgent"
  );
}

/**
 * Get description for a read-only tool action
 */
function getToolDescription(tool: ListFilesTool | ReadFileTool | ReadFilesTool): string {
  switch (tool.action) {
    case "read_file":
      return `Reading ${(tool as ReadFileTool).filePath}`;
    case "read_files": {
      const readFilesTool = tool as ReadFilesTool;
      const fileCount = readFilesTool.tools.length;
      return `Reading ${fileCount} file${fileCount !== 1 ? "s" : ""}`;
    }
    case "list_files":
      return `Listing ${(tool as ListFilesTool).directoryPath}`;
    default: {
      // Exhaustive check - TypeScript will error if a case is missing
      const _exhaustive: never = tool;
      return `Unknown action`;
    }
  }
}

// ============================================================================
// Trigger.dev Task Definition
// ============================================================================

export const askAgentTask = task({
  id: "ask-agent",

  run: async (payload: AskAgentPayload): Promise<AskAgentTaskResult> => {
    const {
      projectId,
      sandboxId,
      userPrompt,
      userId,
      workingDir = REPO_DIR,
      maxIterations = 10,
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
      console.log(
        `${LOG_PREFIXES.CHAT} Using previous agent state with ${state.length - 1} previous messages`
      );
    } else {
      console.log(`${LOG_PREFIXES.CHAT} Starting fresh conversation`);
    }

    await metadata.set("statusMessage", "Analyzing your request...");

    let iterations = 0;

    // Wrap in try-finally to ensure metrics are always sent, even on cancellation
    try {
      while (iterations < maxIterations) {
        iterations++;
        console.log(`${LOG_PREFIXES.CHAT} Iteration ${iterations}/${maxIterations}`);

        // Update metadata for thinking phase
        await metadata.set("iteration", iterations);
        await metadata.set("status", "thinking");
        await metadata.set("statusMessage", "Agent working...");

        let response;
        try {
          response = await callAskAgentWithRetry(
            state,
            workingDir,
            collector,
            userId,
            3
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
          // Handle errors - format for user-friendly display
          const userFriendlyError = formatUserFriendlyError(error);
          console.error(`${LOG_PREFIXES.CHAT} AskAgent error (user-friendly):`, userFriendlyError);

          // Save state before erroring
          await setAgentState(projectId, state);

          await metadata.set("status", "error");
          await metadata.set("statusMessage", userFriendlyError);

          return {
            success: false,
            error: userFriendlyError,
            iterations,
          };
        }

        // Check if ask agent is replying (done)
        if (
          response &&
          "action" in response &&
          response.action === "reply_to_user"
        ) {
          const replyMessage = "message" in response ? response.message : "";
          console.log(
            `${LOG_PREFIXES.CHAT} Ask agent completed with reply:`,
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

          return {
            success: true,
            message: replyMessage,
            iterations,
          };
        }

        // Execute the read-only tool
        const tool = response as ListFilesTool | ReadFileTool | ReadFilesTool;
        const toolDescription = getToolDescription(tool);

        // Update metadata for tool execution
        await metadata.set("status", "executing_tool");
        await metadata.set("currentTool", tool.action);
        await metadata.set("toolDescription", toolDescription);

        // Log tool parameters
        console.log(
          `${LOG_PREFIXES.CHAT} Tool call parameters:`,
          extractToolParams(tool)
        );

        console.log(`${LOG_PREFIXES.CHAT} Executing ${tool.action} tool...`);
        const execResult = await executeSingleTool(
          sandbox,
          tool,
          workingDir,
          [] // Empty todo list for ask agent
        );
        const result = execResult.result;

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
      console.error(
        `${LOG_PREFIXES.CHAT} Ask agent exceeded maximum iterations`
      );
      const error =
        "Ask agent exceeded maximum iterations. Please try again with a simpler question.";

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

      // Deduct credits based on total cost
      const totalRawCost = tokenUsageRecords.reduce((sum, r) => sum + r.costUsd, 0);
      if (totalRawCost > 0) {
        await deductCredits(userId, totalRawCost, projectId);
      }
    }
  },
});
