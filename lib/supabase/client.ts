import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for browser usage.
 * Uses the publishable key (sb_publishable_...) which is safe to expose in client-side code.
 * Never use the secret key here!
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // This should be your publishable key
  );
}

