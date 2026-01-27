"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Auth Callback Page (Client-Side)
 *
 * Handles OAuth callback (code exchange).
 * Must be client-side because some auth flows put tokens in the
 * URL hash fragment, which is only accessible via window.location.hash.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = createClient();

      // Check for error in URL hash
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

      // Get user to verify auth succeeded
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?error=Authentication failed");
        return;
      }

      // Get redirect destination from query params or default
      const searchParams = new URLSearchParams(window.location.search);
      const next = searchParams.get("next") || "/project-gallery";
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
