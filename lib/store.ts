import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { StoreMessage } from "@/types";
import { DEFAULT_PROJECT_NAME } from "@/lib/constants";

interface BuilderState {
  projectName: string;
  projectId: string | null;
  messages: StoreMessage[];
  generatedCode: string;
  sandboxId: string | null;
  previewUrl: string | null;
  setProjectName: (name: string) => void;
  setProjectId: (id: string | null) => void;
  addMessage: (message: StoreMessage) => void;
  setGeneratedCode: (code: string) => void;
  setSandboxId: (id: string | null) => void;
  setPreviewUrl: (url: string | null) => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  projectName: DEFAULT_PROJECT_NAME,
  projectId: null,
  messages: [],
  generatedCode: "",
  sandboxId: null,
  previewUrl: null,
  setProjectName: (name) => set({ projectName: name }),
  setProjectId: (id) => set({ projectId: id }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setGeneratedCode: (code) => set({ generatedCode: code }),
  setSandboxId: (id) => set({ sandboxId: id }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
}));

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      set({ user: null });
      window.location.href = "/";
    } catch (error) {
      console.error("Error logging out:", error);
    }
  },
  checkAuth: async () => {
    set({ loading: true });
    try {
      const response = await fetch("/api/auth/user");
      const data = await response.json();
      if (data.success) {
        set({ user: data.user, loading: false });
      } else {
        set({ user: null, loading: false });
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      set({ user: null, loading: false });
    }
  },
}));
