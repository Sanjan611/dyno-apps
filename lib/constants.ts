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
 * Working directory inside the Modal sandbox
 * This is where the Expo app is created and files are managed
 */
export const WORKING_DIR = "/my-app";

/**
 * Root user directory in sandbox
 */
export const SANDBOX_ROOT = "/root";

/**
 * Full path to the working directory
 */
export const SANDBOX_WORKING_DIR = `${SANDBOX_ROOT}${WORKING_DIR}`;

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
  PROJECT_LOAD: (id: string) => `/api/projects/${id}/load`,
  PROJECT_CHAT: (id: string) => `/api/projects/${id}/chat`,
  
  // Code generation
  INIT_EXPO: "/api/init-expo",
  PROJECT_SANDBOX_LOGS: (id: string) => `/api/projects/${id}/sandbox/logs`,
} as const;

// ============================================================================
// File Patterns
// ============================================================================

/**
 * Common file patterns for Expo/React Native projects
 */
export const FILE_PATTERNS = {
  /** Entry point files */
  ENTRY_FILES: ["App.js", "App.tsx", "app/index.tsx", "app/_layout.tsx"],
  
  /** Config files */
  CONFIG_FILES: ["app.json", "package.json", "tsconfig.json", "babel.config.js"],
  
  /** Directories to ignore in file operations */
  IGNORE_DIRS: ["node_modules", ".git", ".expo"],
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

