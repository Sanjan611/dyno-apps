import { NextResponse } from "next/server";
import { isBuyCreditsEnabled } from "@/lib/features";

/**
 * GET /api/features
 * Returns feature flag values for client-side consumption
 * This keeps the actual env vars server-side only
 */
export async function GET() {
  return NextResponse.json({
    buyCreditsEnabled: isBuyCreditsEnabled(),
  });
}
