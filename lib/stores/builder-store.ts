/**
 * Builder store
 * 
 * Manages project builder state including messages, code, and sandbox info
 * Uses session-scoped persistence (cleared on logout)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StoreMessage } from "@/types";
import { DEFAULT_PROJECT_NAME } from "@/lib/constants";
import { createStorage, STORAGE_KEYS } from "./persist";

/**
 * Sandbox health status
 */
export type SandboxHealthStatus = 
  | "unknown"      // Not yet checked
  | "healthy"      // Sandbox is active and responsive
  | "unhealthy"   // Sandbox exists but not responding
  | "not_found";  // Sandbox doesn't exist

/**
 * File modification tracking
 */
export interface ModifiedFile {
  path: string;
  lastModified: Date;
  content?: string; // Optional: store content for quick access
}

export interface BuilderState {
  // Project info
  projectName: string;
  projectId: string | null;
  
  // Messages and code
  messages: StoreMessage[];
  generatedCode: string;
  
  // Sandbox info
  sandboxId: string | null;
  previewUrl: string | null;
  sandboxHealthStatus: SandboxHealthStatus;
  lastHealthCheck: Date | null;
  
  // Session state
  modifiedFiles: ModifiedFile[];
  lastActivity: Date | null;
  
  // Setters
  setProjectName: (name: string) => void;
  setProjectId: (id: string | null) => void;
  addMessage: (message: StoreMessage) => void;
  setMessages: (messages: StoreMessage[]) => void;
  setGeneratedCode: (code: string) => void;
  setSandboxId: (id: string | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setSandboxHealthStatus: (status: SandboxHealthStatus) => void;
  updateLastHealthCheck: () => void;
  addModifiedFile: (path: string, content?: string) => void;
  clearModifiedFiles: () => void;
  updateLastActivity: () => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  projectName: DEFAULT_PROJECT_NAME,
  projectId: null,
  messages: [],
  generatedCode: "",
  sandboxId: null,
  previewUrl: null,
  sandboxHealthStatus: "unknown" as SandboxHealthStatus,
  lastHealthCheck: null,
  modifiedFiles: [],
  lastActivity: null,
};

/**
 * Builder store with session-scoped persistence
 * State persists during the session but can be cleared on logout
 * 
 * Date objects are automatically serialized/deserialized by the storage adapter
 */
export const useBuilderStore = create<BuilderState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setProjectName: (name) => set({ projectName: name }),
      setProjectId: (id) => set({ projectId: id }),
      
      addMessage: (message) =>
        set((state) => ({ 
          messages: [...state.messages, message],
          lastActivity: new Date(),
        })),
      
      setMessages: (messages) => set({ messages }),
      
      setGeneratedCode: (code) => 
        set({ generatedCode: code, lastActivity: new Date() }),
      
      setSandboxId: (id) => set({ sandboxId: id }),
      setPreviewUrl: (url) => set({ previewUrl: url }),
      
      setSandboxHealthStatus: (status) => 
        set({ sandboxHealthStatus: status }),
      
      updateLastHealthCheck: () => 
        set({ lastHealthCheck: new Date() }),
      
      addModifiedFile: (path, content) =>
        set((state) => {
          const existingIndex = state.modifiedFiles.findIndex(
            (f) => f.path === path
          );
          const newFile: ModifiedFile = {
            path,
            lastModified: new Date(),
            content,
          };
          
          if (existingIndex >= 0) {
            // Update existing file
            const updated = [...state.modifiedFiles];
            updated[existingIndex] = newFile;
            return { 
              modifiedFiles: updated,
              lastActivity: new Date(),
            };
          } else {
            // Add new file
            return { 
              modifiedFiles: [...state.modifiedFiles, newFile],
              lastActivity: new Date(),
            };
          }
        }),
      
      clearModifiedFiles: () => set({ modifiedFiles: [] }),
      
      updateLastActivity: () => set({ lastActivity: new Date() }),
      
      reset: () => set(initialState),
    }),
    {
      name: STORAGE_KEYS.BUILDER,
      storage: createStorage(),
      // Persist all state - Date serialization handled by storage adapter
      partialize: (state) => ({
        projectName: state.projectName,
        projectId: state.projectId,
        messages: state.messages,
        generatedCode: state.generatedCode,
        sandboxId: state.sandboxId,
        previewUrl: state.previewUrl,
        sandboxHealthStatus: state.sandboxHealthStatus,
        lastHealthCheck: state.lastHealthCheck,
        modifiedFiles: state.modifiedFiles,
        lastActivity: state.lastActivity,
      }),
    }
  )
);

