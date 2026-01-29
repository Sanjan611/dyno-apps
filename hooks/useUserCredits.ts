import { useState, useEffect, useCallback } from "react";

/**
 * User credits data from API
 */
interface UserCredits {
  balance: number;
  totalCreditsAdded: number;
  totalCreditsUsed: number;
}

/**
 * Hook for fetching and managing user credits
 * Provides current balance with automatic fetching and manual refetch capability
 */
export function useUserCredits() {
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/user/credits");

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, don't treat as error
          setCredits(null);
          return;
        }
        throw new Error("Failed to fetch credits");
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.error || "Failed to fetch credits");
      }

      setCredits({
        balance: data.balance,
        totalCreditsAdded: data.totalCreditsAdded,
        totalCreditsUsed: data.totalCreditsUsed,
      });
    } catch (err) {
      console.error("[useUserCredits] Error fetching credits:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch credits on mount
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  return {
    credits,
    balance: credits?.balance ?? null,
    isLoading,
    error,
    refetch: fetchCredits,
  };
}
