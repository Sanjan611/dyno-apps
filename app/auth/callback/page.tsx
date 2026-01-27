"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Auth Callback Page (Client-Side)
 *
 * Handles both:
 * 1. Invite link redemption (tokens in URL hash fragment)
 * 2. OAuth callback (code in query params)
 *
 * Must be client-side because Supabase invite links put tokens in the
 * URL hash fragment (e.g., #access_token=...), which is never sent to
 * the server - only accessible via window.location.hash in the browser.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = createClient();

      // Check for error in URL hash (from invite links)
      const hashParams = new URLSearchParams(
        window.location.hash.substring(1)
      );
      const errorParam = hashParams.get("error");
      const errorDescription = hashParams.get("error_description");

      if (errorParam) {
        router.push(
          `/login?error=${encodeURIComponent(errorDescription || errorParam)}`
        );
        return;
      }

      // Supabase client automatically picks up tokens from URL hash
      // Wait for auth state to be set
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        // Try exchanging code if present (for OAuth flows)
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            router.push(
              `/login?error=${encodeURIComponent(exchangeError.message)}`
            );
            return;
          }
        } else {
          router.push("/login?error=Invalid authentication request");
          return;
        }
      }

      // Get user to check metadata
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?error=Authentication failed");
        return;
      }

      // Check if user needs to set password (invited users only)
      const isInvitedUser = user.user_metadata?.invited === true;
      const passwordSet = user.user_metadata?.password_set === true;
      const needsPasswordSetup = isInvitedUser && !passwordSet;

      if (needsPasswordSetup) {
        router.push("/set-password");
      } else {
        // Get redirect destination from query params or default
        const searchParams = new URLSearchParams(window.location.search);
        const next = searchParams.get("next") || "/project-gallery";
        router.push(next);
      }
    };

    handleAuthCallback();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
