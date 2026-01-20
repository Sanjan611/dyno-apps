/**
 * Conversation History Store - Supabase Persistence
 *
 * Stores user-visible chat messages per project in Supabase.
 * This is separate from agent_state which stores BAML Message[] for LLM context.
 * Conversation history is saved when the user explicitly saves the project.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { LOG_PREFIXES } from "@/lib/constants";

/**
 * Message format for conversation history persistence
 * Only stores user-visible messages (user and assistant roles)
 */
export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO string
  mode?: "ask" | "build";
}

/**
 * Get the conversation history for a project from Supabase
 */
export async function getConversationHistory(
  projectId: string
): Promise<ConversationMessage[] | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("conversation_history")
      .select("messages")
      .eq("project_id", projectId)
      .single();

    if (error) {
      // PGRST116 means no rows found, which is expected for new projects
      if (error.code === "PGRST116") {
        return null;
      }
      console.error(
        `${LOG_PREFIXES.PROJECTS} Error fetching conversation history:`,
        error.message
      );
      return null;
    }

    return data?.messages as ConversationMessage[] | null;
  } catch (error) {
    console.error(
      `${LOG_PREFIXES.PROJECTS} Error in getConversationHistory:`,
      error
    );
    return null;
  }
}

/**
 * Save the conversation history for a project in Supabase
 * Uses upsert to create or update the history
 */
export async function saveConversationHistory(
  projectId: string,
  messages: ConversationMessage[]
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("conversation_history").upsert(
      {
        project_id: projectId,
        messages,
        saved_at: new Date().toISOString(),
      },
      {
        onConflict: "project_id",
      }
    );

    if (error) {
      console.error(
        `${LOG_PREFIXES.PROJECTS} Error saving conversation history:`,
        error.message
      );
      throw error;
    }
  } catch (error) {
    console.error(
      `${LOG_PREFIXES.PROJECTS} Error in saveConversationHistory:`,
      error
    );
    throw error;
  }
}

/**
 * Clear the conversation history for a project
 * Called when a project is deleted or when we want to reset the conversation
 */
export async function clearConversationHistory(
  projectId: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("conversation_history")
      .delete()
      .eq("project_id", projectId);

    if (error) {
      console.error(
        `${LOG_PREFIXES.PROJECTS} Error clearing conversation history:`,
        error.message
      );
      // Don't throw - clearing history is best-effort
    }
  } catch (error) {
    console.error(
      `${LOG_PREFIXES.PROJECTS} Error in clearConversationHistory:`,
      error
    );
    // Don't throw - clearing history is best-effort
  }
}
