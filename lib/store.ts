/**
 * Store re-exports for backward compatibility
 * 
 * This file re-exports stores from their new locations in lib/stores/
 * to maintain backward compatibility with existing imports.
 * 
 * The stores have been refactored into separate files with persistence:
 * - lib/stores/auth-store.ts - Authentication state with localStorage persistence
 * - lib/stores/builder-store.ts - Builder state with session persistence
 */

// Re-export auth store
export { useAuthStore } from "./stores/auth-store";
export type { AuthState } from "./stores/auth-store";

// Re-export builder store
export { useBuilderStore } from "./stores/builder-store";
export type { BuilderState, SandboxHealthStatus, CreditsState } from "./stores/builder-store";

// Re-export persistence utilities
export {
  STORAGE_KEYS,
  localStorageStorage,
  createStorage,
  clearAllPersistedState,
} from "./stores/persist";
