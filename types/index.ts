/**
 * Centralized type definitions for Dyno Apps
 * 
 * This file consolidates shared interfaces to eliminate duplication
 * across components and provide a single source of truth.
 */

// Re-export BAML-generated types for convenience
export type {
  BashTool,
  ListFilesTool,
  ReadFileTool,
  WriteFileTool,
  TodoWriteTool,
  TodoItem,
  VerifyExpoServerTool,
  ReplyToUser,
  FileTools,
  ReadOnlyTools,
  TodoTools,
  Message as BAMLMessage,
} from "@/baml_client/types";

// ============================================================================
// Chat & Message Types
// ============================================================================

/**
 * Chat message for the builder UI
 * Used in ChatPanel and store
 */
export interface Message {
  id: string;
  role: "user" | "assistant" | "thinking";
  content: string;
  timestamp: Date;
  actions?: AgentAction[];
  isComplete?: boolean;
}

/**
 * Store-level message (simplified, without thinking-specific fields)
 * Used in Zustand store for persistence
 */
export interface StoreMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ============================================================================
// Agent & Thinking Types
// ============================================================================

/**
 * Agent action types for the thinking visualization
 */
export type AgentActionType = 
  | 'status' 
  | 'list_files' 
  | 'read_file' 
  | 'write_file' 
  | 'todo' 
  | 'parallel_read';

/**
 * Agent action for thinking box visualization
 */
export interface AgentAction {
  id: string;
  type: AgentActionType;
  description: string;
  timestamp: Date;
  status: 'in_progress' | 'completed';
}

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project entity from database
 * Represents a user's mobile app project
 */
export interface Project {
  id: string;
  title: string;
  description: string | null;
  repositoryUrl: string | null;
  currentSandboxId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project for insertion (without auto-generated fields)
 */
export interface ProjectInsert {
  title: string;
  description?: string | null;
  repositoryUrl?: string | null;
  currentSandboxId?: string | null;
  userId: string;
}

/**
 * Project update payload
 */
export interface ProjectUpdate {
  title?: string;
  description?: string | null;
  repositoryUrl?: string | null;
  currentSandboxId?: string | null;
}

/**
 * Project with formatted display fields
 * Used in UI components
 */
export interface ProjectWithMeta extends Project {
  lastModified: string;
}

// ============================================================================
// Sandbox Types
// ============================================================================

/**
 * Sandbox status values
 */
export type SandboxStatus = 
  | 'created' 
  | 'reused' 
  | 'active' 
  | 'not_created' 
  | 'not_found' 
  | 'inaccessible';

/**
 * Sandbox info returned by API
 */
export interface SandboxInfo {
  sandboxId: string | null;
  status: SandboxStatus;
  previewUrl?: string | null;
  message: string;
}

// ============================================================================
// SSE (Server-Sent Events) Types
// ============================================================================

/**
 * SSE event types for code generation streaming
 */
export type SSEEventType = 
  | 'status' 
  | 'coding_iteration' 
  | 'todo_update' 
  | 'complete' 
  | 'error'
  | 'stopped';

/**
 * Todo item in SSE progress events
 */
export interface SSETodoItem {
  content: string;
  activeForm: string;
  status: string;
}

/**
 * SSE progress event for code generation
 */
export interface SSEProgressEvent {
  type: SSEEventType;
  message?: string;
  iteration?: number;
  tool?: string;
  todo?: string;
  todos?: SSETodoItem[];
  error?: string;
  details?: unknown;
  files?: Record<string, string>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * File contents map (path -> content)
 */
export type FileContentsMap = Record<string, string>;

/**
 * Function to check if a value is a specific SSE event type
 */
export function isSSEEventType(type: string): type is SSEEventType {
  return ['status', 'coding_iteration', 'todo_update', 'complete', 'error', 'stopped'].includes(type);
}

/**
 * Function to check if a value is a valid agent action type
 */
export function isAgentActionType(type: string): type is AgentActionType {
  return ['status', 'list_files', 'read_file', 'write_file', 'todo', 'parallel_read'].includes(type);
}


