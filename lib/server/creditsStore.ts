/**
 * Credits Store - User Credit Balance Management
 *
 * Credits are tied to API cost with configurable margin:
 * - $1 marked up = 10 credits
 * - Formula: credits = rawCost × (1 + margin%) × 10
 *
 * Example: $0.05 raw API cost → $0.10 marked up (100% margin) → 1 credit consumed
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Constants
const CREDITS_PER_DOLLAR = 10;
const DEFAULT_MARGIN_PERCENTAGE = 100;
const DEFAULT_INITIAL_CREDITS = 10;

const LOG_PREFIX = "[creditsStore]";

/**
 * User credits record from database
 */
export interface UserCredits {
  userId: string;
  balance: number;
  totalCreditsAdded: number;
  totalCreditsUsed: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get margin percentage from environment variable or default
 */
export function getMarginPercentage(): number {
  const envValue = process.env.CREDIT_MARGIN_PERCENTAGE;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_MARGIN_PERCENTAGE;
}

/**
 * Get initial credits for new users from environment variable or default
 */
export function getInitialCredits(): number {
  const envValue = process.env.INITIAL_CREDITS;
  if (envValue) {
    const parsed = parseFloat(envValue);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_INITIAL_CREDITS;
}

/**
 * Convert raw API cost (USD) to credits
 * Formula: credits = rawCost × (1 + margin%) × 10
 */
export function calculateCreditsFromCost(rawCostUsd: number): number {
  const margin = getMarginPercentage();
  const markedUpCost = rawCostUsd * (1 + margin / 100);
  return markedUpCost * CREDITS_PER_DOLLAR;
}

/**
 * Get user credits, auto-creating with initial credits if not exists.
 * Uses the authenticated user's session for read operations.
 */
export async function getUserCredits(userId: string): Promise<UserCredits> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    // If no record exists (PGRST116), create one with initial credits
    if (error.code === "PGRST116") {
      const initialCredits = getInitialCredits();
      const { data: newData, error: insertError } = await supabase
        .from("user_credits")
        .insert({
          user_id: userId,
          balance: initialCredits,
          total_credits_added: initialCredits,
          total_credits_used: 0,
        })
        .select("*")
        .single();

      if (insertError) {
        // If insert fails due to unique constraint (race condition), fetch existing
        if (insertError.code === "23505") {
          const { data: existingData, error: fetchError } = await supabase
            .from("user_credits")
            .select("*")
            .eq("user_id", userId)
            .single();

          if (!fetchError && existingData) {
            return mapDbToUserCredits(existingData);
          }
        }
        console.error(
          LOG_PREFIX,
          "Error creating user credits:",
          userId,
          "error:",
          insertError
        );
        // Return default values if insert fails
        return {
          userId,
          balance: initialCredits,
          totalCreditsAdded: initialCredits,
          totalCreditsUsed: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return mapDbToUserCredits(newData!);
    }

    // For other errors, log and return default
    console.error(
      LOG_PREFIX,
      "Error fetching user credits:",
      userId,
      "error:",
      error
    );
    const initialCredits = getInitialCredits();
    return {
      userId,
      balance: initialCredits,
      totalCreditsAdded: initialCredits,
      totalCreditsUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return mapDbToUserCredits(data);
}

/**
 * Deduct credits after an agent run.
 * Uses service client for atomic deduction via RPC function.
 *
 * Note: Allows balance to go negative per design (current run completes,
 * future runs blocked until topped up).
 */
export async function deductCredits(
  userId: string,
  rawCostUsd: number,
  projectId: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (rawCostUsd <= 0) {
    return { success: true, newBalance: 0 };
  }

  const creditsToDeduct = calculateCreditsFromCost(rawCostUsd);

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("deduct_user_credits", {
      p_user_id: userId,
      p_credits_to_deduct: creditsToDeduct,
    });

    if (error) {
      console.error(
        LOG_PREFIX,
        "Error deducting credits:",
        userId,
        "projectId:",
        projectId,
        "error:",
        error
      );
      return { success: false, newBalance: 0, error: error.message };
    }

    // RPC returns array with single result
    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.success) {
      console.error(
        LOG_PREFIX,
        "Credit deduction failed:",
        userId,
        "error:",
        result?.error_message
      );
      return {
        success: false,
        newBalance: 0,
        error: result?.error_message || "Unknown error",
      };
    }

    console.log(
      LOG_PREFIX,
      `Deducted ${creditsToDeduct.toFixed(4)} credits from user ${userId}`,
      `(raw cost: $${rawCostUsd.toFixed(6)}, project: ${projectId})`,
      `New balance: ${result.new_balance}`
    );

    return {
      success: true,
      newBalance: Number(result.new_balance),
    };
  } catch (error) {
    console.error(
      LOG_PREFIX,
      "Exception deducting credits:",
      userId,
      "error:",
      error
    );
    return {
      success: false,
      newBalance: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Add credits to a user's balance (admin operation).
 * Uses service client for atomic addition via RPC function.
 */
export async function addCredits(
  userId: string,
  amount: number
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (amount <= 0) {
    return { success: false, newBalance: 0, error: "Amount must be positive" };
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("add_user_credits", {
      p_user_id: userId,
      p_credits_to_add: amount,
    });

    if (error) {
      console.error(LOG_PREFIX, "Error adding credits:", userId, "error:", error);
      return { success: false, newBalance: 0, error: error.message };
    }

    // RPC returns array with single result
    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.success) {
      console.error(
        LOG_PREFIX,
        "Credit addition failed:",
        userId,
        "error:",
        result?.error_message
      );
      return {
        success: false,
        newBalance: 0,
        error: result?.error_message || "Unknown error",
      };
    }

    console.log(
      LOG_PREFIX,
      `Added ${amount} credits to user ${userId}`,
      `New balance: ${result.new_balance}`
    );

    return {
      success: true,
      newBalance: Number(result.new_balance),
    };
  } catch (error) {
    console.error(LOG_PREFIX, "Exception adding credits:", userId, "error:", error);
    return {
      success: false,
      newBalance: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all users with their credit balances (admin operation).
 * Uses service client to bypass RLS.
 */
export async function getAllUserCredits(): Promise<
  Array<UserCredits & { email?: string }>
> {
  try {
    const supabase = createServiceClient();

    // First get all credit records
    const { data: creditsData, error: creditsError } = await supabase
      .from("user_credits")
      .select("*")
      .order("updated_at", { ascending: false });

    if (creditsError) {
      console.error(
        LOG_PREFIX,
        "Error fetching all user credits:",
        creditsError
      );
      return [];
    }

    // Get user emails from auth.users
    const userIds = creditsData?.map((c) => c.user_id) || [];
    if (userIds.length === 0) {
      return [];
    }

    // Fetch user details from auth.users via admin API
    const { data: usersData, error: usersError } =
      await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error(LOG_PREFIX, "Error fetching users:", usersError);
      // Return credits without emails
      return (creditsData || []).map(mapDbToUserCredits);
    }

    // Create a map of user_id to email
    const emailMap = new Map<string, string>();
    for (const user of usersData?.users || []) {
      if (user.email) {
        emailMap.set(user.id, user.email);
      }
    }

    // Combine credits with emails
    return (creditsData || []).map((record) => ({
      ...mapDbToUserCredits(record),
      email: emailMap.get(record.user_id),
    }));
  } catch (error) {
    console.error(LOG_PREFIX, "Exception fetching all user credits:", error);
    return [];
  }
}

/**
 * Map database record to UserCredits interface
 */
function mapDbToUserCredits(record: {
  user_id: string;
  balance: number | string;
  total_credits_added: number | string;
  total_credits_used: number | string;
  created_at: string;
  updated_at: string;
}): UserCredits {
  return {
    userId: record.user_id,
    balance: Number(record.balance),
    totalCreditsAdded: Number(record.total_credits_added),
    totalCreditsUsed: Number(record.total_credits_used),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
