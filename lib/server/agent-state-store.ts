/**
 * In-memory storage for agent conversation state
 * 
 * Stores the full BAML Message[] state per project to maintain context
 * across multiple requests. State is stored in memory and cleared
 * when projects are deleted or after a timeout.
 */

import type { Message } from "@/baml_client/types";

/**
 * In-memory storage: projectId -> agent state
 */
const agentStateStore = new Map<string, Message[]>();

/**
 * Get the agent state for a project
 */
export function getAgentState(projectId: string): Message[] | undefined {
  return agentStateStore.get(projectId);
}

/**
 * Set the agent state for a project
 */
export function setAgentState(projectId: string, state: Message[]): void {
  agentStateStore.set(projectId, state);
}

/**
 * Clear the agent state for a project
 * Called when a project is deleted or when we want to reset the conversation
 */
export function clearAgentState(projectId: string): void {
  agentStateStore.delete(projectId);
}

/**
 * Clear all agent states (useful for cleanup/testing)
 */
export function clearAllAgentStates(): void {
  agentStateStore.clear();
}

