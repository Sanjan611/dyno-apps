import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getWaitlistEntryByEmail } from "@/lib/server/waitlistStore";

/**
 * Signup API Route
 *
 * Creates user accounts for approved waitlist emails only.
 * Users must:
 * 1. Join the waitlist at /api/waitlist
 * 2. Wait for an admin to approve them
 * 3. Sign up with their approved email and chosen password
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate required fields
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is on the approved waitlist
    const waitlistEntry = await getWaitlistEntryByEmail(normalizedEmail);

    if (!waitlistEntry) {
      // Don't reveal if email exists or not - use generic message
      return NextResponse.json(
        {
          success: false,
          error: "This email is not approved for beta access. Please join the waitlist first.",
        },
        { status: 403 }
      );
    }

    if (waitlistEntry.status === "pending") {
      return NextResponse.json(
        {
          success: false,
          error: "Your application is still pending review. You'll receive an email when approved.",
        },
        { status: 403 }
      );
    }

    if (waitlistEntry.status === "rejected") {
      // Don't reveal rejection - use same message as not found
      return NextResponse.json(
        {
          success: false,
          error: "This email is not approved for beta access. Please join the waitlist first.",
        },
        { status: 403 }
      );
    }

    // Email is approved - create the user account
    const supabase = createServiceClient();

    const { data: authData, error: signupError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // Auto-confirm since they went through waitlist
    });

    if (signupError) {
      // Handle "user already exists" error
      if (signupError.message?.includes("already been registered") ||
          signupError.message?.includes("already exists")) {
        return NextResponse.json(
          {
            success: false,
            error: "An account with this email already exists. Try logging in instead.",
          },
          { status: 409 }
        );
      }

      console.error("[signup] Failed to create user:", signupError);
      return NextResponse.json(
        { success: false, error: signupError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account created successfully. You can now log in.",
    });
  } catch (error) {
    console.error("[signup] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create account",
      },
      { status: 500 }
    );
  }
}
