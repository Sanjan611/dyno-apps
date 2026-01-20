/**
 * Agent State Store - Supabase Persistence
 *
 * Stores the full BAML Message[] state per project in Supabase.
 * This allows state to persist across:
 * - Multiple user requests (conversation continuity)
 * - Server restarts (Vercel deployments)
 * - Trigger.dev worker processes (separate from Next.js)
 */

import type { Message } from "@/baml_client/types";
import { createServiceClient } from "@/lib/supabase/service";
import { LOG_PREFIXES } from "@/lib/constants";

/**
 * Get the agent state for a project from Supabase
 */
export async function getAgentState(
  projectId: string
): Promise<Message[] | undefined> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("agent_state")
      .select("state")
      .eq("project_id", projectId)
      .single();

    if (error) {
      // PGRST116 means no rows found, which is expected for new projects
      if (error.code === "PGRST116") {
        return undefined;
      }
      console.error(
        `${LOG_PREFIXES.CHAT} Error fetching agent state:`,
        error.message
      );
      return undefined;
    }

    return data?.state as Message[] | undefined;
  } catch (error) {
    console.error(`${LOG_PREFIXES.CHAT} Error in getAgentState:`, error);
    return undefined;
  }
}

/**
 * Set the agent state for a project in Supabase
 * Uses upsert to create or update the state
 */
export async function setAgentState(
  projectId: string,
  state: Message[]
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("agent_state").upsert(
      {
        project_id: projectId,
        state,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "project_id",
      }
    );

    if (error) {
      console.error(
        `${LOG_PREFIXES.CHAT} Error saving agent state:`,
        error.message
      );
      throw error;
    }
  } catch (error) {
    console.error(`${LOG_PREFIXES.CHAT} Error in setAgentState:`, error);
    throw error;
  }
}

/**
 * Clear the agent state for a project
 * Called when a project is deleted or when we want to reset the conversation
 */
export async function clearAgentState(projectId: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("agent_state")
      .delete()
      .eq("project_id", projectId);

    if (error) {
      console.error(
        `${LOG_PREFIXES.CHAT} Error clearing agent state:`,
        error.message
      );
      // Don't throw - clearing state is best-effort
    }
  } catch (error) {
    console.error(`${LOG_PREFIXES.CHAT} Error in clearAgentState:`, error);
    // Don't throw - clearing state is best-effort
  }
}
