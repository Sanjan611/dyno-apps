# Per-Request Metrics Tracking

Research document covering how tokens, model usage, and costs are tracked when users make requests to coding agents.

## Summary

Per-request metrics (tokens, model, cost) are tracked using **ClickHouse Cloud** as the external metrics backend. The system captures token usage, model identification, and request metadata during each coding agent iteration via BAML's `Collector` object. However, **cost calculation does not exist** in the codebase - only raw token counts are stored.

## Architecture Overview

The metrics system follows a pipeline architecture:

1. **BAML Collector** captures LLM call metadata during agent execution
2. **Metrics extraction** pulls token counts, model name, and latency from the collector
3. **Batch insertion** sends accumulated records to ClickHouse at request completion

The system is designed for high-volume metrics collection with graceful degradation - if ClickHouse is unavailable, metrics are skipped without breaking the main application flow.

## Data Flow

```
User Request (POST /api/projects/[id]/chat)
    ↓
runCodingAgent() / runAskAgent()  [lib/server/coding-agent.ts]
    ├─ BAML Collector created
    ├─ Agent loop iterations
    │   ├─ LLM call via BAML client
    │   └─ Collector records: tokens, model, latency
    └─ tokenUsageRecords[] accumulated
    ↓
recordTokenUsageBatch()  [lib/server/clickhouse.ts]
    ↓
ClickHouse Cloud (token_usage table)
```

1. **Entry Point**: `POST /api/projects/[id]/chat` receives user request
2. **Collection**: Each LLM call through BAML automatically records usage via `Collector`
3. **Extraction**: `extractBamlMetrics()` parses collector data for tokens, model, latency
4. **Storage**: Batch insertion to ClickHouse happens in `finally` block (even on errors)

## Key Files

| File | Purpose | Key Functions/Components |
|------|---------|-------------------------|
| `lib/server/clickhouse.ts:1-80` | ClickHouse client and metrics storage | `recordTokenUsageBatch()`, `TokenUsageRecord` |
| `lib/server/coding-agent.ts:104-165` | Metrics extraction from BAML | `extractBamlMetrics()` |
| `lib/server/coding-agent.ts:170-350` | Agent orchestration with metrics | `runCodingAgent()`, `runAskAgent()` |
| `trigger/coding-agent.ts:308-323` | Trigger.dev task metrics | Metrics collection in `finally` block |
| `trigger/ask-agent.ts:255-270` | Ask agent task metrics | Metrics collection in `finally` block |
| `baml_src/clients.baml` | LLM client definitions | `GLMWithSonnetFallback`, `ClaudeSonnet` |

## Component Relationships

### BAML Collector → Metrics Extraction → ClickHouse

The BAML `Collector` (imported from `@boundaryml/baml`) is passed to every LLM call. After each iteration, `extractBamlMetrics()` at `lib/server/coding-agent.ts:104` parses:

- `inputTokens`, `outputTokens`, `cachedInputTokens` from HTTP response metadata
- Model name parsed from the request body
- Provider name (openrouter, anthropic)
- Call duration in milliseconds

Records accumulate in a `TokenUsageRecord[]` array during the agent loop, then `recordTokenUsageBatch()` at `lib/server/clickhouse.ts:52` performs bulk insertion.

## TokenUsageRecord Schema

```typescript
interface TokenUsageRecord {
  userId: string;
  projectId: string;
  iteration: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  model: string;
}
```

## What Does NOT Exist

| Feature | Status |
|---------|--------|
| Cost calculation | Not implemented |
| Pricing model per LLM | Not implemented |
| Metrics in Supabase | Uses external ClickHouse |
| User-level aggregation | Not implemented |
| Usage dashboards/UI | Not implemented |
| Boundary Studio integration | Mentioned but not used |
| Rate limiting by tokens | Not implemented |

## External Integrations

### ClickHouse Cloud

Primary metrics storage:

- Endpoint configured via `CLICKHOUSE_HOST`
- Authentication via `CLICKHOUSE_USER` and `CLICKHOUSE_PASSWORD`
- Table: `token_usage`
- Client uses native HTTP protocol with batch inserts

## Configuration

Environment variables in `.env.local`:

```
CLICKHOUSE_HOST=https://xxx.region.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<password>
```

If `CLICKHOUSE_HOST` is not set, metrics collection silently skips (`lib/server/clickhouse.ts:52-55`).
