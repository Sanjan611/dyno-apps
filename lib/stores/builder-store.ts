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
 * User credits state
 */
export interface CreditsState {
  balance: number | null;
  isLoading: boolean;
  lastFetched: Date | null;
}

export interface BuilderState {
  // Project info (NOT persisted - set from route)
  projectName: string;
  projectId: string | null;

  // Messages (NOT persisted)
  messages: StoreMessage[];

  // Sandbox info (NOT persisted - ephemeral per session)
  sandboxId: string | null;
  previewUrl: string | null;
  sandboxHealthStatus: SandboxHealthStatus;
  lastHealthCheck: Date | null;
  sandboxStarted: boolean;

  // Sandbox startup progress (NOT persisted - for UI display)
  sandboxProgressMessages: string[];
  sandboxCurrentProgress: string | null;
  sandboxError: string | null;
  isStartingSandbox: boolean;

  // User credits (NOT persisted - fetched from API)
  credits: CreditsState;

  // Chat mode (PERSISTED - user preference)
  currentMode: MessageMode;

  // Setters
  setProjectName: (name: string) => void;
  setProjectId: (id: string | null) => void;
  addMessage: (message: StoreMessage) => void;
  setMessages: (messages: StoreMessage[]) => void;
  setSandboxId: (id: string | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setSandboxHealthStatus: (status: SandboxHealthStatus) => void;
  updateLastHealthCheck: () => void;
  setSandboxStarted: (started: boolean) => void;
  setCurrentMode: (mode: MessageMode) => void;
  refreshCredits: () => Promise<void>;

  // Sandbox startup progress setters
  addSandboxProgressMessage: (message: string) => void;
  setSandboxCurrentProgress: (progress: string | null) => void;
  setSandboxError: (error: string | null) => void;
  setIsStartingSandbox: (isStarting: boolean) => void;
  clearSandboxProgress: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  projectName: DEFAULT_PROJECT_NAME,
  projectId: null,
  messages: [],
  sandboxId: null,
  previewUrl: null,
  sandboxHealthStatus: "unknown" as SandboxHealthStatus,
  lastHealthCheck: null,
  currentMode: "build" as MessageMode, // Default to build mode
  sandboxStarted: false,
  sandboxProgressMessages: [] as string[],
  sandboxCurrentProgress: null as string | null,
  sandboxError: null as string | null,
  isStartingSandbox: false,
  credits: {
    balance: null,
    isLoading: false,
    lastFetched: null,
  } as CreditsState,
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
        })),

      setMessages: (messages) => set({ messages }),

      setSandboxId: (id) => set({ sandboxId: id }),
      setPreviewUrl: (url) => set({ previewUrl: url }),

      setSandboxHealthStatus: (status) =>
        set({ sandboxHealthStatus: status }),

      updateLastHealthCheck: () =>
        set({ lastHealthCheck: new Date() }),

      setSandboxStarted: (started) =>
        set({ sandboxStarted: started }),

      // Sandbox startup progress setters
      addSandboxProgressMessage: (message) =>
        set((state) => ({
          sandboxProgressMessages: [...state.sandboxProgressMessages, message],
        })),

      setSandboxCurrentProgress: (progress) =>
        set({ sandboxCurrentProgress: progress }),

      setSandboxError: (error) =>
        set({ sandboxError: error }),

      setIsStartingSandbox: (isStarting) =>
        set({ isStartingSandbox: isStarting }),

      clearSandboxProgress: () =>
        set({
          sandboxProgressMessages: [],
          sandboxCurrentProgress: null,
          sandboxError: null,
          isStartingSandbox: false,
        }),

      setCurrentMode: (mode) => set({ currentMode: mode }),

      refreshCredits: async () => {
        console.log("[builder-store] refreshCredits called");
        set((state) => ({
          credits: { ...state.credits, isLoading: true },
        }));

        try {
          const response = await fetch(`/api/user/credits?_t=${Date.now()}`);
          if (!response.ok) {
            if (response.status === 401) {
              // User not authenticated
              set({
                credits: { balance: null, isLoading: false, lastFetched: null },
              });
              return;
            }
            throw new Error("Failed to fetch credits");
          }

          const data = await response.json();
          console.log("[builder-store] Credits API response:", data);
          if (data.success === false) {
            throw new Error(data.error || "Failed to fetch credits");
          }

          set({
            credits: {
              balance: data.balance,
              isLoading: false,
              lastFetched: new Date(),
            },
          });
          console.log("[builder-store] Credits updated to:", data.balance);
        } catch (error) {
          console.error("[builder-store] Error fetching credits:", error);
          set((state) => ({
            credits: { ...state.credits, isLoading: false },
          }));
        }
      },

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
