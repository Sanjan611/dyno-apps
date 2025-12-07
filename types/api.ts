/**
 * API Request/Response Types
 * 
 * Standardized types for API communication patterns.
 * These types ensure consistent API responses across all endpoints.
 */

import type { Project, ProjectWithMeta, SandboxInfo, SandboxStatus } from "./index";

// ============================================================================
// Base API Response Types
// ============================================================================

/**
 * Base success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
}

/**
 * Base error response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

/**
 * Generic API response union type
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// Project API Types
// ============================================================================

/**
 * POST /api/projects - Create project request
 */
export interface CreateProjectRequest {
  name?: string;
  title?: string;
  description?: string | null;
  firstMessage?: string;
  repositoryUrl?: string | null;
}

/**
 * POST /api/projects - Create project response
 */
export interface CreateProjectResponse {
  success: boolean;
  project?: ProjectWithMeta;
  error?: string;
}

/**
 * GET /api/projects - Get all projects response
 */
export interface GetProjectsResponse {
  success: boolean;
  projects?: ProjectWithMeta[];
  error?: string;
}

/**
 * GET /api/projects?projectId=X - Get single project response
 */
export interface GetProjectResponse {
  success: boolean;
  project?: ProjectWithMeta;
  error?: string;
}

/**
 * PATCH /api/projects - Update project request
 */
export interface UpdateProjectRequest {
  projectId: string;
  name?: string;
  title?: string;
}

/**
 * PATCH /api/projects - Update project response
 */
export interface UpdateProjectResponse {
  success: boolean;
  project?: ProjectWithMeta;
  error?: string;
}

/**
 * DELETE /api/projects/[id] - Delete project response
 */
export interface DeleteProjectResponse {
  success: boolean;
  projectId?: string;
  sandboxTerminated?: boolean;
  sandboxAlreadyMissing?: boolean;
  githubRepoDeleted?: boolean;
  githubRepoAlreadyMissing?: boolean;
  error?: string;
}

// ============================================================================
// Sandbox API Types
// ============================================================================

/**
 * POST /api/projects/[id]/sandbox - Create/get sandbox response
 */
export interface CreateSandboxResponse {
  success: boolean;
  sandboxId?: string;
  status?: SandboxStatus;
  message?: string;
  error?: string;
}

/**
 * GET /api/projects/[id]/sandbox - Get sandbox info response
 */
export interface GetSandboxResponse {
  success: boolean;
  sandboxId?: string | null;
  status?: SandboxStatus;
  previewUrl?: string | null;
  message?: string;
  error?: string;
}

/**
 * GET /api/projects/[id]/sandbox/health - Health check response
 */
export interface SandboxHealthResponse {
  success: boolean;
  exists?: boolean;
  healthy?: boolean;
  previewUrl?: string | null;
  error?: string;
}

/**
 * DELETE /api/projects/[id]/sandbox - Terminate sandbox response
 */
export interface TerminateSandboxResponse {
  success: boolean;
  projectId?: string;
  sandboxTerminated?: boolean;
  sandboxAlreadyMissing?: boolean;
  message?: string;
  error?: string;
}

// ============================================================================
// Code Generation API Types
// ============================================================================

/**
 * POST /api/projects/[id]/chat - Request body
 */
export interface ChatRequest {
  userPrompt: string;
}

/**
 * POST /api/init-expo - Request body
 */
export interface InitExpoRequest {
  sandboxId: string;
  skipInit?: boolean;
  repositoryUrl?: string | null;
  projectId?: string;
}

/**
 * POST /api/init-expo - Response
 */
export interface InitExpoResponse {
  success: boolean;
  previewUrl?: string;
  error?: string;
  logs?: {
    stdout?: string;
    stderr?: string;
  };
}

// ============================================================================
// Auth API Types
// ============================================================================

/**
 * POST /api/auth/login - Request body
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * POST /api/auth/signup - Request body
 */
export interface SignupRequest {
  email: string;
  password: string;
  confirmPassword?: string;
}

/**
 * Auth API response (login/signup)
 */
export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  error?: string;
}

/**
 * GET /api/auth/user - Response
 */
export interface GetUserResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    // Add other user fields as needed
  } | null;
  error?: string;
}

// ============================================================================
// Project Load/Save API Types
// ============================================================================

/**
 * POST /api/projects/[id]/save - Request body
 */
export interface SaveProjectRequest {
  files: Record<string, string>;
}

/**
 * POST /api/projects/[id]/save - Response
 */
export interface SaveProjectResponse {
  success: boolean;
  savedFiles?: string[];
  error?: string;
}

/**
 * GET /api/projects/[id]/load - Response
 */
export interface LoadProjectResponse {
  success: boolean;
  files?: Record<string, string>;
  error?: string;
}

// ============================================================================
// Sandbox Logs API Types
// ============================================================================

/**
 * GET /api/projects/[id]/sandbox/logs - Response
 */
export interface SandboxLogsResponse {
  success: boolean;
  logs?: {
    expoLogs?: string;
    processCheck?: string;
  };
  error?: string;
}


