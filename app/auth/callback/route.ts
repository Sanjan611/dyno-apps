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
 * For invited users who haven't set a password, redirects to /set-password.
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

    // Check if this is an invited user who needs to set a password
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const passwordSet = user.user_metadata?.password_set === true;

      // If user hasn't set a password yet, redirect to set-password page
      if (!passwordSet) {
        const setPasswordUrl = new URL("/set-password", origin);
        return NextResponse.redirect(setPasswordUrl);
      }
    }

    // Successfully authenticated with password set - redirect to the app
    const redirectUrl = new URL(next, origin);
    return NextResponse.redirect(redirectUrl);
  }

  // No code provided - redirect to login
  console.error("[auth/callback] No code provided");
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "Invalid authentication request");
  return NextResponse.redirect(loginUrl);
}
