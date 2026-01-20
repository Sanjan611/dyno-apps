/**
 * Builder store
 * 
 * Manages project builder state including messages, code, and sandbox info.
 * 
 * IMPORTANT: Only user preferences (like currentMode) are persisted to storage.
 * Project-scoped state (projectId, sandboxId, previewUrl, etc.) is NOT persisted
 * to prevent stale state when navigating between projects. The URL is the source
 * of truth for project identity.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StoreMessage, MessageMode } from "@/types";
import type { FileNode } from "@/types/api";
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

/**
 * Cached file content for code viewer
 */
export interface CachedFile {
  content: string;
  language: string;
}

export interface BuilderState {
  // Project info (NOT persisted - set from route)
  projectName: string;
  projectId: string | null;

  // Messages and code (NOT persisted)
  messages: StoreMessage[];
  generatedCode: string;

  // Sandbox info (NOT persisted - ephemeral per session)
  sandboxId: string | null;
  previewUrl: string | null;
  sandboxHealthStatus: SandboxHealthStatus;
  lastHealthCheck: Date | null;
  sandboxStarted: boolean;

  // Session state (NOT persisted)
  modifiedFiles: ModifiedFile[];
  lastActivity: Date | null;

  // Code viewer state (NOT persisted)
  codeViewerDirty: boolean;
  codeViewerFileTree: FileNode[] | null;
  codeViewerSelectedPath: string | null;
  codeViewerFileContent: string;
  codeViewerOriginalContent: string;
  codeViewerFileLanguage: string;
  codeViewerFileCache: Record<string, CachedFile>;

  // Chat mode (PERSISTED - user preference)
  currentMode: MessageMode;

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
  setSandboxStarted: (started: boolean) => void;
  addModifiedFile: (path: string, content?: string) => void;
  clearModifiedFiles: () => void;
  updateLastActivity: () => void;
  setCurrentMode: (mode: MessageMode) => void;
  setCodeViewerDirty: (dirty: boolean) => void;
  setCodeViewerFileTree: (tree: FileNode[] | null) => void;
  setCodeViewerSelectedFile: (path: string | null, content: string, originalContent: string, language: string) => void;
  cacheCodeViewerFile: (path: string, content: string, language: string) => void;
  clearCodeViewerCache: () => void;

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
  codeViewerDirty: false,
  codeViewerFileTree: null as FileNode[] | null,
  codeViewerSelectedPath: null as string | null,
  codeViewerFileContent: "",
  codeViewerOriginalContent: "",
  codeViewerFileLanguage: "plaintext",
  codeViewerFileCache: {} as Record<string, CachedFile>,
  currentMode: "build" as MessageMode, // Default to build mode
  sandboxStarted: false,
};

/**
 * Builder store with minimal persistence
 * 
 * Only user preferences are persisted (e.g., currentMode).
 * Project-scoped state is NOT persisted - the URL (/builder/<projectId>) 
 * is the source of truth for project identity.
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
      
      setSandboxStarted: (started) => 
        set({ sandboxStarted: started }),
      
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

      setCurrentMode: (mode) => set({ currentMode: mode }),

      setCodeViewerDirty: (dirty) => set({ codeViewerDirty: dirty }),

      setCodeViewerFileTree: (tree) => set({ codeViewerFileTree: tree }),

      setCodeViewerSelectedFile: (path, content, originalContent, language) =>
        set({
          codeViewerSelectedPath: path,
          codeViewerFileContent: content,
          codeViewerOriginalContent: originalContent,
          codeViewerFileLanguage: language,
        }),

      cacheCodeViewerFile: (path, content, language) =>
        set((state) => ({
          codeViewerFileCache: {
            ...state.codeViewerFileCache,
            [path]: { content, language },
          },
        })),

      clearCodeViewerCache: () =>
        set({
          codeViewerFileTree: null,
          codeViewerSelectedPath: null,
          codeViewerFileContent: "",
          codeViewerOriginalContent: "",
          codeViewerFileLanguage: "plaintext",
          codeViewerFileCache: {},
        }),

      reset: () => set(initialState),
    }),
    {
      name: STORAGE_KEYS.BUILDER,
      storage: createStorage(),
      // Only persist user preferences - NOT project-scoped state
      // The URL (/builder/<projectId>) is the source of truth for project identity
      partialize: (state) => ({
        currentMode: state.currentMode,
      }),
    }
  )
);
