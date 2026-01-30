/**
 * Feature flag utilities
 *
 * Server-side only - use the hook or API endpoint for client components
 */

/**
 * Check if buy credits feature is enabled (server-side only)
 * For client components, use the useBuyCreditsEnabled hook from lib/hooks/useFeatures.ts
 */
export function isBuyCreditsEnabled(): boolean {
  return process.env.FEATURE_BUY_CREDITS === "true";
}
