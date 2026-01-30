"use client";

import { useState, useEffect } from "react";

interface FeaturesState {
  buyCreditsEnabled: boolean;
  isLoading: boolean;
}

/**
 * Hook to get feature flags on the client side
 * Fetches from /api/features to keep env vars server-side only
 */
export function useFeatures(): FeaturesState {
  const [state, setState] = useState<FeaturesState>({
    buyCreditsEnabled: false,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function fetchFeatures() {
      try {
        const response = await fetch("/api/features");
        if (response.ok && mounted) {
          const data = await response.json();
          setState({
            buyCreditsEnabled: data.buyCreditsEnabled ?? false,
            isLoading: false,
          });
        } else if (mounted) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        if (mounted) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    }

    fetchFeatures();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

/**
 * Convenience hook for just the buy credits feature flag
 */
export function useBuyCreditsEnabled(): { enabled: boolean; isLoading: boolean } {
  const { buyCreditsEnabled, isLoading } = useFeatures();
  return { enabled: buyCreditsEnabled, isLoading };
}
