import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with secret key for server-to-server operations.
 * This bypasses RLS and should only be used for background tasks (like Trigger.dev)
 * where we don't have access to user session cookies.
 *
 * Uses the new Supabase secret key format (sb_secret_...) which replaces the
 * legacy service_role key. See: https://github.com/orgs/supabase/discussions/29260
 *
 * IMPORTANT: Never expose this client to the frontend or use in client-side code.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
