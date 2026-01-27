import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth Callback Handler
 *
 * Handles both:
 * 1. Invite link redemption (from email invites)
 * 2. Google OAuth callback
 *
 * Exchanges the code for a session and redirects to the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error("[auth/callback] OAuth error:", error, errorDescription);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "error",
      errorDescription || error || "Authentication failed"
    );
    return NextResponse.redirect(loginUrl);
  }

  // Exchange code for session
  if (code) {
    const supabase = await createClient();

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error(
        "[auth/callback] Failed to exchange code:",
        exchangeError.message
      );
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(loginUrl);
    }

    // Check if user needs to set password (invited users only)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isInvitedUser = user?.user_metadata?.invited === true;
    const passwordSet = user?.user_metadata?.password_set === true;
    const needsPasswordSetup = isInvitedUser && !passwordSet;

    if (needsPasswordSetup) {
      const setPasswordUrl = new URL("/set-password", origin);
      return NextResponse.redirect(setPasswordUrl);
    }

    // Successfully authenticated - redirect to the app
    const redirectUrl = new URL(next, origin);
    return NextResponse.redirect(redirectUrl);
  }

  // No code provided - redirect to login
  console.error("[auth/callback] No code provided");
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "Invalid authentication request");
  return NextResponse.redirect(loginUrl);
}
