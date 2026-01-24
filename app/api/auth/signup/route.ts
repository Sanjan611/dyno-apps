import { NextRequest, NextResponse } from "next/server";

/**
 * Signup API Route (Disabled)
 *
 * Direct signups are disabled. Users must:
 * 1. Join the waitlist at /api/waitlist
 * 2. Wait for an admin to send them an invite
 * 3. Click the invite link in their email to complete signup
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error:
        "Direct signups are disabled. Please request beta access from the homepage and wait for an invite.",
    },
    { status: 403 }
  );
}
