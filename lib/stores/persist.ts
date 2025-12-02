/**
 * Persistence utilities for Zustand stores
 * 
 * Provides localStorage-based persistence with session support
 */

import { StateStorage, createJSONStorage } from "zustand/middleware";

/**
 * Storage key prefixes for different persistence scopes
 */
export const STORAGE_KEYS = {
  /** Auth state (persists across sessions) */
  AUTH: "dyno-auth",
  /** Builder state (session-scoped, cleared on logout) */
  BUILDER: "dyno-builder",
} as const;

/**
 * localStorage-based storage implementation
 * Handles serialization/deserialization and error handling
 */
export const localStorageStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(name);
    } catch (error) {
      console.warn(`[persist] Failed to get item "${name}":`, error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(name, value);
    } catch (error) {
      console.warn(`[persist] Failed to set item "${name}":`, error);
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(name);
    } catch (error) {
      console.warn(`[persist] Failed to remove item "${name}":`, error);
    }
  },
};

/**
 * sessionStorage-based storage implementation
 * Automatically cleared when browser tab/window closes
 */
export const sessionStorageStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === "undefined") return null;
      return window.sessionStorage.getItem(name);
    } catch (error) {
      console.warn(`[persist] Failed to get session item "${name}":`, error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === "undefined") return;
      window.sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn(`[persist] Failed to set session item "${name}":`, error);
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === "undefined") return;
      window.sessionStorage.removeItem(name);
    } catch (error) {
      console.warn(`[persist] Failed to remove session item "${name}":`, error);
    }
  },
};

/**
 * Recursively convert ISO date strings back to Date objects
 * Used after deserialization from storage
 */
function convertDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
    return new Date(obj);
  }
  if (Array.isArray(obj)) return obj.map(convertDates);
  if (typeof obj === "object" && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, convertDates(value)])
    );
  }
  return obj;
}

/**
 * Custom storage adapter that handles Date deserialization
 * Zustand's createJSONStorage handles serialization (Dates become strings)
 * This adapter converts date strings back to Date objects on read
 */
function createDateAwareStorage(storage: StateStorage): StateStorage {
  return {
    getItem: (name: string): string | null => {
      const value = storage.getItem(name);
      if (!value || typeof value !== "string") return null;
      
      try {
        const parsed = JSON.parse(value);
        // Recursively convert ISO date strings back to Date objects
        const withDates = convertDates(parsed);
        return JSON.stringify(withDates);
      } catch {
        return value;
      }
    },
    setItem: (name: string, value: string): void => {
      // createJSONStorage already serialized Dates to strings, just store as-is
      storage.setItem(name, value);
    },
    removeItem: (name: string): void => {
      storage.removeItem(name);
    },
  };
}

/**
 * Create a JSON storage adapter for Zustand
 * Uses localStorage by default with Date serialization support
 * 
 * Note: Dates are automatically serialized to ISO strings by createJSONStorage.
 * This adapter converts them back to Date objects on read.
 */
export function createStorage(storage: StateStorage = localStorageStorage) {
  return createJSONStorage(() => createDateAwareStorage(storage));
}

/**
 * Clear all persisted state
 * Useful for logout or reset operations
 */
export function clearAllPersistedState(): void {
  try {
    if (typeof window === "undefined") return;
    Object.values(STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });
  } catch (error) {
    console.warn("[persist] Failed to clear persisted state:", error);
  }
}

