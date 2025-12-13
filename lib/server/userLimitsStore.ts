import { createClient } from "@/lib/supabase/server";

/**
 * Result of checking if a user can create a new project
 */
export interface ProjectLimitCheck {
  allowed: boolean;
  currentCount: number;
  limit: number;
}

/**
 * Gets the maximum number of projects allowed for a user.
 * Automatically creates a default limit record (3 projects) if one doesn't exist.
 */
export async function getUserLimit(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_limits")
    .select("max_projects")
    .eq("user_id", userId)
    .single();

  if (error) {
    // If no record exists (PGRST116), create one with default limit
    if (error.code === "PGRST116") {
      const { data: newData, error: insertError } = await supabase
        .from("user_limits")
        .insert({
          user_id: userId,
          max_projects: 3, // Default limit
        })
        .select("max_projects")
        .single();

      if (insertError) {
        // If insert fails due to unique constraint (race condition), fetch the existing record
        if (insertError.code === "23505") {
          const { data: existingData, error: fetchError } = await supabase
            .from("user_limits")
            .select("max_projects")
            .eq("user_id", userId)
            .single();

          if (!fetchError && existingData) {
            return existingData.max_projects;
          }
        }
        console.error("[userLimitsStore] Error creating user limit:", userId, "error:", insertError);
        // Return default even if insert fails
        return 3;
      }

      return newData?.max_projects ?? 3;
    }
    // For other errors, log and return default
    console.error("[userLimitsStore] Error fetching user limit:", userId, "error:", error);
    return 3;
  }

  return data?.max_projects ?? 3;
}

/**
 * Gets the current number of projects for a user.
 */
export async function getUserProjectCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("[userLimitsStore] Error counting user projects:", userId, "error:", error);
    throw error;
  }

  return count ?? 0;
}

/**
 * Checks if a user can create a new project.
 * Returns whether creation is allowed, current count, and limit.
 */
export async function checkProjectLimit(userId: string): Promise<ProjectLimitCheck> {
  const [limit, currentCount] = await Promise.all([
    getUserLimit(userId),
    getUserProjectCount(userId),
  ]);

  return {
    allowed: currentCount < limit,
    currentCount,
    limit,
  };
}

