# Plan: Per-Request Token Cost Tracking

## Overview

Add cost calculation to existing token tracking infrastructure. Calculate cost based on model pricing and store it alongside token counts in ClickHouse for analytics and future billing.

## Current State

- **Token tracking exists**: ClickHouse `token_usage` table stores `user_id`, `project_id`, `iteration`, `input_tokens`, `output_tokens`, `cached_input_tokens`, `model`
- **No cost calculation**: Only raw token counts stored
- **Model in use**: `gpt-5` via OpenAI (`CustomGPT5Chat` in `baml_src/clients.baml:22-28`)
- **Batch insertion**: `recordTokenUsageBatch()` in `lib/server/clickhouse.ts:56-89`

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pricing storage | Supabase `model_pricing` table | Flexible, no redeploy to update prices, supports multiple models |
| Cost calculation | At insertion time, stored in ClickHouse | Fast aggregations, pricing snapshot preserved at time of use |
| Cost unit | USD (stored as Decimal) | Standard currency, easy to convert later |

## Implementation Steps

### Step 1: Supabase Migration - Model Pricing Table

**File**: `supabase/migrations/YYYYMMDD_add_model_pricing.sql`

```sql
-- Model pricing configuration
CREATE TABLE public.model_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name TEXT UNIQUE NOT NULL,
  input_cost_per_million DECIMAL(10, 6) NOT NULL,
  cached_input_cost_per_million DECIMAL(10, 6) NOT NULL,
  output_cost_per_million DECIMAL(10, 6) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX model_pricing_model_name_idx ON public.model_pricing(model_name) WHERE is_active = true;

-- Enable RLS - pricing is public read
ALTER TABLE public.model_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active pricing" ON public.model_pricing
  FOR SELECT USING (is_active = true);

-- Seed GPT-5 pricing (placeholder values - update with actual)
INSERT INTO public.model_pricing (model_name, input_cost_per_million, cached_input_cost_per_million, output_cost_per_million) VALUES
  ('gpt-5', 2.50, 1.25, 10.00),
  ('gpt-5-mini', 0.15, 0.075, 0.60),
  ('claude-sonnet-4-5-20250929', 3.00, 1.50, 15.00),
  ('z-ai/glm-4.6', 1.50, 0.75, 4.50);
```

### Step 2: Create Pricing Store

**File**: `lib/server/pricingStore.ts`

```typescript
import { createClient } from "@/lib/supabase/server";

export interface ModelPricing {
  modelName: string;
  inputCostPerMillion: number;
  cachedInputCostPerMillion: number;
  outputCostPerMillion: number;
}

// Cache pricing to avoid repeated DB calls
let pricingCache: Map<string, ModelPricing> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getPricing(modelName: string): Promise<ModelPricing | null> {
  await refreshCacheIfNeeded();
  return pricingCache?.get(modelName) ?? null;
}

export async function calculateCost(
  modelName: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number
): Promise<number> {
  const pricing = await getPricing(modelName);
  if (!pricing) {
    console.warn(`[pricing] No pricing found for model: ${modelName}`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPerMillion;
  const cachedCost = (cachedInputTokens / 1_000_000) * pricing.cachedInputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPerMillion;

  return inputCost + cachedCost + outputCost;
}

async function refreshCacheIfNeeded(): Promise<void> {
  if (pricingCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return;
  }
  // Fetch and populate cache from Supabase...
}
```

### Step 3: Update ClickHouse Schema

**ClickHouse DDL** (run via ClickHouse console or migration tool):

```sql
ALTER TABLE token_usage ADD COLUMN cost_usd Decimal64(8) DEFAULT 0;
```

### Step 4: Update ClickHouse Client

**File**: `lib/server/clickhouse.ts`

Add `costUsd` to interface:
```typescript
export interface TokenUsageRecord {
  userId: string;
  projectId: string;
  iteration: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  model: string;
  costUsd: number;  // NEW
}
```

Update batch insert to include cost:
```typescript
values: records.map((r) => ({
  user_id: r.userId,
  project_id: r.projectId,
  iteration: r.iteration,
  input_tokens: r.inputTokens,
  output_tokens: r.outputTokens,
  cached_input_tokens: r.cachedInputTokens,
  model: r.model,
  cost_usd: r.costUsd,  // NEW
})),
```

### Step 5: Integrate Cost Calculation into Agent Flow

**File**: `lib/server/coding-agent.ts`

After extracting metrics from BAML, calculate cost before pushing to records:

```typescript
// After: const metrics = extractBamlMetrics(collector, false);
const cost = await calculateCost(
  metrics.model ?? 'unknown',
  metrics.inputTokens ?? 0,
  metrics.cachedInputTokens ?? 0,
  metrics.outputTokens ?? 0
);

tokenUsageRecords.push({
  userId,
  projectId,
  iteration: iterations,
  inputTokens: metrics.inputTokens ?? 0,
  outputTokens: metrics.outputTokens ?? 0,
  cachedInputTokens: metrics.cachedInputTokens ?? 0,
  model: metrics.model ?? "unknown",
  costUsd: cost,  // NEW
});
```

Same changes in:
- `runAskAgent()` function in same file
- `trigger/coding-agent.ts` (Trigger.dev task)
- `trigger/ask-agent.ts` (Trigger.dev ask task)

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/YYYYMMDD_add_model_pricing.sql` | New - pricing table with seed data |
| `lib/server/pricingStore.ts` | New - pricing lookup and cost calculation |
| `lib/server/clickhouse.ts` | Add `costUsd` field to interface and insert |
| `lib/server/coding-agent.ts` | Calculate cost in `runCodingAgent()` and `runAskAgent()` |
| `trigger/coding-agent.ts` | Calculate cost before pushing to records |
| `trigger/ask-agent.ts` | Calculate cost before pushing to records |

## Verification

1. **Migration**: Run `supabase db push`, verify `model_pricing` table exists with seed data

2. **Pricing lookup**: Test in isolation:
   ```typescript
   const cost = await calculateCost('gpt-5', 1000, 500, 200);
   // Expected: (1000/1M * 2.50) + (500/1M * 1.25) + (200/1M * 10.00)
   //         = 0.0025 + 0.000625 + 0.002 = 0.005125
   ```

3. **End-to-end**: Run an agent request, then query ClickHouse:
   ```sql
   SELECT
     user_id,
     project_id,
     model,
     input_tokens,
     output_tokens,
     cached_input_tokens,
     cost_usd
   FROM token_usage
   ORDER BY timestamp DESC
   LIMIT 10;
   ```
   Verify `cost_usd` is populated and non-zero.

4. **Aggregation query** (for future dashboards):
   ```sql
   SELECT
     user_id,
     SUM(cost_usd) as total_cost,
     SUM(input_tokens) as total_input,
     SUM(output_tokens) as total_output
   FROM token_usage
   WHERE timestamp >= today() - INTERVAL 30 DAY
   GROUP BY user_id
   ORDER BY total_cost DESC;
   ```

## Notes

- Placeholder pricing values used; update `model_pricing` table with actual GPT-5 rates
- Pricing cache has 5-minute TTL to balance freshness vs DB load
- Unknown models log a warning and record $0 cost (won't break flow)
- ClickHouse schema change must be applied separately (not via Supabase)
