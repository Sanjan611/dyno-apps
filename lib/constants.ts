/**
 * Application Constants
 * 
 * Centralized magic values and configuration constants.
 * This eliminates hardcoded values scattered across the codebase.
 */

// ============================================================================
// Sandbox & Expo Configuration
// ============================================================================

/**
 * Repository directory inside the Modal sandbox
 * This is where the GitHub repo is cloned and the agent works
 */
export const REPO_DIR = "/repo";

/**
 * Full path to the working directory inside the Modal sandbox
 * This is where the Expo app is created and files are managed
 * Note: The path /my-app is also hardcoded in BAML files (baml_src/coding-agent.baml)
 */
export const SANDBOX_WORKING_DIR = "/root/my-app";

/**
 * Expo web server port
 */
export const EXPO_PORT = 19006;

/**
 * Ports exposed by the sandbox
 */
export const SANDBOX_PORTS = [EXPO_PORT] as const;

// ============================================================================
// Timeout Configuration
// ============================================================================

/**
 * Timeouts for various operations (in milliseconds)
 */
export const TIMEOUTS = {
  /** Tunnel connection timeout */
  TUNNEL_CONNECTION: 5000,
  
  /** Tunnel fetch timeout */
  TUNNEL_FETCH: 3000,
  
  /** Base delay for Expo initialization retry */
  EXPO_INIT_BASE_DELAY: 2000,
  
  /** Maximum delay between Expo init retries */
  EXPO_INIT_MAX_DELAY: 5000,
  
  /** Maximum attempts for Expo initialization */
  EXPO_INIT_MAX_ATTEMPTS: 6,
  
  /** Default bash command timeout */
  BASH_COMMAND_DEFAULT: 120_000, // 2 minutes
  
  /** Maximum bash command timeout */
  BASH_COMMAND_MAX: 600_000, // 10 minutes
  
  /** BAML request timeout */
  BAML_REQUEST: 40_000,
  
  /** Quick sandbox health check */
  SANDBOX_QUICK_CHECK: 2000,
} as const;

// ============================================================================
// Content Limits
// ============================================================================

/**
 * Maximum content sizes
 */
export const CONTENT_LIMITS = {
  /** Maximum lint output characters before truncation */
  LINT_OUTPUT: 30_000,
  
  /** Maximum bash output characters before truncation */
  BASH_OUTPUT: 30_000,
  
  /** Maximum file content characters for display */
  FILE_CONTENT_DISPLAY: 50_000,
} as const;

// ============================================================================
// UI Configuration
// ============================================================================

/**
 * Default project name for new projects
 */
export const DEFAULT_PROJECT_NAME = "Untitled Project";

/**
 * Resizable panel constraints (percentages)
 */
export const PANEL_CONSTRAINTS: {
  MIN_WIDTH: number;
  MAX_WIDTH: number;
  DEFAULT_LEFT_WIDTH: number;
} = {
  MIN_WIDTH: 25,
  MAX_WIDTH: 75,
  DEFAULT_LEFT_WIDTH: 50,
};

// ============================================================================
// API Configuration
// ============================================================================

/**
 * API endpoints (relative paths)
 */
export const API_ENDPOINTS = {
  // Auth
  LOGIN: "/api/auth/login",
  LOGOUT: "/api/auth/logout",
  SIGNUP: "/api/auth/signup",
  USER: "/api/auth/user",
  
  // Projects
  PROJECTS: "/api/projects",
  PROJECT: (id: string) => `/api/projects/${id}`,
  PROJECT_SANDBOX: (id: string) => `/api/projects/${id}/sandbox`,
  PROJECT_SANDBOX_HEALTH: (id: string) => `/api/projects/${id}/sandbox/health`,
  PROJECT_SAVE: (id: string) => `/api/projects/${id}/save`,
  PROJECT_CHAT: (id: string) => `/api/projects/${id}/chat`,
  PROJECT_CHAT_CANCEL: (id: string) => `/api/projects/${id}/chat/cancel`,
  PROJECT_HISTORY: (id: string) => `/api/projects/${id}/history`,

  // Code generation
  INIT_EXPO: "/api/init-expo",
  PROJECT_SANDBOX_LOGS: (id: string) => `/api/projects/${id}/sandbox/logs`,
} as const;

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Standard error messages
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Unauthorized",
  PROJECT_NOT_FOUND: "Project not found",
  SANDBOX_NOT_FOUND: "Sandbox not found",
  INVALID_REQUEST: "Invalid request",
  INTERNAL_ERROR: "Internal server error",
} as const;

// ============================================================================
// Logging Prefixes
// ============================================================================

/**
 * Logging prefixes for consistent log messages
 */
export const LOG_PREFIXES = {
  SANDBOX: "[sandbox]",
  PROJECTS: "[projects]",
  CHAT: "[chat]",
  INIT_EXPO: "[init-expo]",
  AUTH: "[auth]",
} as const;

