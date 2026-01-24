/**
 * Waitlist Store
 *
 * Database operations for managing beta access waitlist.
 * Uses service client to bypass RLS.
 */

import { createServiceClient } from "@/lib/supabase/service";

export interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  use_case: string | null;
  status: "pending" | "approved" | "rejected";
  invited_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Add a new entry to the waitlist
 */
export async function addToWaitlist(
  email: string,
  name?: string,
  company?: string,
  useCase?: string
): Promise<{ success: boolean; error?: string; entry?: WaitlistEntry }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("waitlist")
    .insert({
      email: email.toLowerCase().trim(),
      name: name?.trim() || null,
      company: company?.trim() || null,
      use_case: useCase?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate email gracefully
    if (error.code === "23505") {
      return {
        success: false,
        error: "This email is already on the waitlist",
      };
    }
    console.error("[waitlistStore] Failed to add to waitlist:", error);
    return { success: false, error: error.message };
  }

  return { success: true, entry: data as WaitlistEntry };
}

/**
 * Get waitlist entries, optionally filtered by status
 */
export async function getWaitlistEntries(
  status?: "pending" | "approved" | "rejected"
): Promise<WaitlistEntry[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[waitlistStore] Failed to get waitlist entries:", error);
    return [];
  }

  return data as WaitlistEntry[];
}

/**
 * Get a single waitlist entry by ID
 */
export async function getWaitlistEntryById(
  id: string
): Promise<WaitlistEntry | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("waitlist")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[waitlistStore] Failed to get waitlist entry:", error);
    return null;
  }

  return data as WaitlistEntry;
}

/**
 * Update waitlist entry status
 */
export async function updateWaitlistStatus(
  id: string,
  status: "pending" | "approved" | "rejected"
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("waitlist")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("[waitlistStore] Failed to update status:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Mark a waitlist entry as invited (sets invited_at and status to approved)
 */
export async function markAsInvited(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("waitlist")
    .update({
      status: "approved",
      invited_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[waitlistStore] Failed to mark as invited:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
