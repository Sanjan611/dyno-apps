/**
 * Pricing Store
 *
 * Provides model pricing lookup and cost calculation functionality.
 * Prices are stored in Supabase and cached in memory for performance.
 *
 * Note: Uses direct Supabase client (not Next.js server client) to work
 * in both API routes and Trigger.dev tasks without cookies dependency.
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Pricing information for a single model
 */
export interface ModelPricing {
  modelName: string;
  inputCostPerMillion: number;
  cachedInputCostPerMillion: number;
  outputCostPerMillion: number;
}

// In-memory cache for pricing data
let pricingCache: Map<string, ModelPricing> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a Supabase client for pricing lookups.
 * Uses anon key since model_pricing has public read RLS policy.
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL or anon key not configured");
  }

  return createClient(url, anonKey);
}

/**
 * Refreshes the pricing cache from Supabase if needed
 */
async function refreshCacheIfNeeded(): Promise<void> {
  if (pricingCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("model_pricing")
      .select("model_name, input_cost_per_million, cached_input_cost_per_million, output_cost_per_million")
      .eq("is_active", true);

    if (error) {
      console.error("[pricing] Failed to fetch pricing from Supabase:", error);
      // Keep stale cache if available
      if (pricingCache) {
        console.warn("[pricing] Using stale cache due to fetch error");
        return;
      }
      // Initialize empty cache if no cache exists
      pricingCache = new Map();
      cacheTimestamp = Date.now();
      return;
    }

    // Populate cache
    const newCache = new Map<string, ModelPricing>();
    for (const row of data || []) {
      newCache.set(row.model_name, {
        modelName: row.model_name,
        inputCostPerMillion: Number(row.input_cost_per_million),
        cachedInputCostPerMillion: Number(row.cached_input_cost_per_million),
        outputCostPerMillion: Number(row.output_cost_per_million),
      });
    }

    pricingCache = newCache;
    cacheTimestamp = Date.now();
    console.log(`[pricing] Loaded pricing for ${newCache.size} models`);
  } catch (error) {
    console.error("[pricing] Error refreshing cache:", error);
    // Keep stale cache if available, or initialize empty
    if (!pricingCache) {
      pricingCache = new Map();
      cacheTimestamp = Date.now();
    }
  }
}

/**
 * Gets pricing for a specific model
 *
 * @param modelName - The model identifier (e.g., "gpt-5", "claude-sonnet-4-5-20250929")
 * @returns Pricing info or null if not found
 */
export async function getPricing(modelName: string): Promise<ModelPricing | null> {
  await refreshCacheIfNeeded();
  return pricingCache?.get(modelName) ?? null;
}

/**
 * Calculates the cost in USD for a given token usage
 *
 * @param modelName - The model identifier
 * @param inputTokens - Number of input tokens (non-cached)
 * @param cachedInputTokens - Number of cached input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD, or 0 if model pricing not found
 */
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

/**
 * Clears the pricing cache (useful for testing)
 */
export function clearPricingCache(): void {
  pricingCache = null;
  cacheTimestamp = 0;
}
