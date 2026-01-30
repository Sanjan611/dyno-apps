/**
 * Feature flag utilities
 */

export function isBuyCreditsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_BUY_CREDITS === "true";
}
