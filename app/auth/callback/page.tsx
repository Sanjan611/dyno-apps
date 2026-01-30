"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Auth Callback Page (Client-Side)
 *
 * Handles OAuth callback (code exchange) and password recovery flows.
 * Must be client-side because some auth flows put tokens in the
 * URL hash fragment, which is only accessible via window.location.hash.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = createClient();
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      // Check for error in URL hash or query params
      const errorParam = hashParams.get("error") || searchParams.get("error");
      const errorDescription = hashParams.get("error_description") || searchParams.get("error_description");

      if (errorParam) {
        router.push(
          `/login?error=${encodeURIComponent(errorDescription || errorParam)}`
        );
        return;
      }

      // Get the redirect destination from query params
      const next = searchParams.get("next") || "/project-gallery";

      // Check if this is a password recovery flow (tokens in hash with type=recovery)
      const hashType = hashParams.get("type");
      const isRecoveryFlow = hashType === "recovery";

      // Try to get existing session first
      let {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      // If no session, try exchanging code (PKCE flow)
      if (!session) {
        const code = searchParams.get("code");

        if (code) {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error("[auth/callback] Code exchange error:", exchangeError);
            router.push(
              `/login?error=${encodeURIComponent(exchangeError.message)}`
            );
            return;
          }
          session = data.session;
        }
      }

      // For hash-based recovery flows, the Supabase client should auto-detect
      // Give it a moment to process and re-check
      if (!session && (hashParams.get("access_token") || isRecoveryFlow)) {
        // Wait briefly for Supabase to process hash tokens
        await new Promise((resolve) => setTimeout(resolve, 100));
        const result = await supabase.auth.getSession();
        session = result.data.session;
      }

      if (!session) {
        console.error("[auth/callback] No session established");
        router.push("/login?error=Invalid authentication request");
        return;
      }

      // Get user to verify auth succeeded
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?error=Authentication failed");
        return;
      }

      // For password recovery, redirect to reset-password page
      // Check if the session was established via recovery flow
      if (isRecoveryFlow || next === "/reset-password") {
        router.push("/reset-password");
        return;
      }

      router.push(next);
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
