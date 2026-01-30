import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getBaseUrl(request: NextRequest): string {
  // Use NEXT_PUBLIC_APP_URL if set (production/staging)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Try to get from request headers (works in production with proper proxy setup)
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  if (host) {
    return `${protocol}://${host}`;
  }

  // Fallback for local development
  return "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: "Email is required",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Send password reset email
    // Supabase will send an email with a link to /auth/callback?code=...&next=/reset-password
    const redirectUrl = `${getBaseUrl(request)}/auth/callback?next=/reset-password`;
    console.log("[auth/forgot-password] Redirect URL:", redirectUrl);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error("[auth/forgot-password] Error:", error);
      // Don't reveal whether the email exists - always return success
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (error) {
    console.error("[auth/forgot-password] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
