/**
 * Authentication store
 * 
 * Manages user authentication state with persistence across sessions
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@supabase/supabase-js";
import { createStorage, STORAGE_KEYS } from "./persist";

export interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

/**
 * Authentication store with localStorage persistence
 * User state persists across browser sessions
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: STORAGE_KEYS.AUTH,
      storage: createStorage(),
      // Only persist user, not loading state
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);

