/**
 * ClickHouse Client Module
 *
 * Provides token usage tracking functionality using ClickHouse Cloud.
 * Metrics are collected during agent loop iterations and batch-inserted
 * at the end of each request for efficiency.
 */

import { createClient, ClickHouseClient } from "@clickhouse/client";

let client: ClickHouseClient | null = null;

/**
 * Creates or returns a singleton ClickHouse client instance
 */
function getClickHouseClient(): ClickHouseClient {
  if (!client) {
    const host = process.env.CLICKHOUSE_HOST;
    const username = process.env.CLICKHOUSE_USER;
    const password = process.env.CLICKHOUSE_PASSWORD;

    if (!host) {
      throw new Error("CLICKHOUSE_HOST not configured");
    }

    client = createClient({
      url: host,
      username: username ?? "default",
      password: password ?? "",
    });
  }
  return client;
}

/**
 * Token usage record for a single agent iteration
 */
export interface TokenUsageRecord {
  userId: string;
  projectId: string;
  iteration: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  model: string;
  costUsd: number;
}

/**
 * Batch inserts token usage records to ClickHouse
 *
 * This function is designed to be non-blocking - metrics failures
 * are logged but don't affect the main agent flow.
 *
 * @param records - Array of token usage records to insert
 */
export async function recordTokenUsageBatch(
  records: TokenUsageRecord[]
): Promise<void> {
  if (records.length === 0) return;

  // Skip if ClickHouse not configured (graceful degradation)
  if (!process.env.CLICKHOUSE_HOST) {
    console.log(
      "[clickhouse] Skipping metrics - CLICKHOUSE_HOST not configured"
    );
    return;
  }

  try {
    const clickhouse = getClickHouseClient();
    await clickhouse.insert({
      table: "token_usage",
      values: records.map((r) => ({
        user_id: r.userId,
        project_id: r.projectId,
        iteration: r.iteration,
        input_tokens: r.inputTokens,
        output_tokens: r.outputTokens,
        cached_input_tokens: r.cachedInputTokens,
        model: r.model,
        cost_usd: r.costUsd,
      })),
      format: "JSONEachRow",
    });
    console.log(`[clickhouse] Recorded ${records.length} token usage entries`);
  } catch (error) {
    // Log but don't throw - metrics should not break main flow
    console.error("[clickhouse] Failed to record token usage:", error);
  }
}
