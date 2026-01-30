import { useCallback } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { useBuilderStore } from "@/lib/store";

/**
 * Hook for managing explicit sandbox startup
 * Handles sandbox health check, creation, and Expo initialization
 *
 * Requires projectId to be already set in the store (project must exist before sandbox startup)
 */
export function useSandboxStartup() {
  const {
    setSandboxId,
    setPreviewUrl,
    setSandboxStarted,
    projectId,
    // Progress state from store
    sandboxProgressMessages,
    sandboxCurrentProgress,
    sandboxError,
    isStartingSandbox,
    addSandboxProgressMessage,
    setSandboxCurrentProgress,
    setSandboxError,
    setIsStartingSandbox,
    clearSandboxProgress,
  } = useBuilderStore();

  const startSandbox = useCallback(async (): Promise<void> => {
    setIsStartingSandbox(true);
    setSandboxError(null);
    clearSandboxProgress();

    try {
      // Project must already exist - projectId should be set by the route
      const currentProjectId = projectId;

      if (!currentProjectId) {
        throw new Error("Project ID is required. Please ensure you're on a valid project page.");
      }

      // Step 1: Check if existing sandbox is healthy and can be reused
      setSandboxCurrentProgress("Checking existing sandbox...");
      try {
        const healthResponse = await fetch(
          API_ENDPOINTS.PROJECT_SANDBOX_HEALTH(currentProjectId)
        );
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          if (healthData.success && healthData.healthy && healthData.previewUrl) {
            // Reuse existing healthy sandbox
            setSandboxId(healthData.sandboxId);
            setPreviewUrl(healthData.previewUrl);
            setSandboxStarted(true);
            addSandboxProgressMessage("Existing sandbox ready");
            setSandboxCurrentProgress(null);
            return; // Skip creation
          }
        }
      } catch (error) {
        console.warn("[useSandboxStartup] Error checking sandbox health:", error);
        // Continue with creation flow
      }
      setSandboxCurrentProgress(null);

      // Guard: Check if another concurrent call already succeeded (React Strict Mode race condition)
      // Read fresh state from the store to handle concurrent startSandbox calls
      if (useBuilderStore.getState().sandboxStarted) {
        console.log("[useSandboxStartup] Another call already completed, skipping");
        return;
      }

      // Step 2: Terminate any existing unhealthy sandbox before creating new one
      try {
        await fetch(API_ENDPOINTS.PROJECT_SANDBOX(currentProjectId), {
          method: "DELETE",
        });
        // Don't fail if sandbox doesn't exist - that's fine
      } catch (error) {
        console.warn("[useSandboxStartup] Error terminating existing sandbox:", error);
        // Continue anyway - sandbox might not exist
      }

      // Step 3: Create a new sandbox
      setSandboxCurrentProgress("Creating sandbox...");
      const sandboxResponse = await fetch(API_ENDPOINTS.PROJECT_SANDBOX(currentProjectId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!sandboxResponse.ok) {
        const errorText = await sandboxResponse.text();
        let errorMessage = `Failed to create sandbox: ${sandboxResponse.status} ${sandboxResponse.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      const sandboxData = await sandboxResponse.json();

      if (!sandboxData.success || !sandboxData.sandboxId) {
        throw new Error(sandboxData.error || "Failed to create sandbox");
      }

      const newSandboxId = sandboxData.sandboxId;
      setSandboxId(newSandboxId);
      addSandboxProgressMessage("Sandbox created");
      setSandboxCurrentProgress(null);

      // Step 4: Verify project has currentSandboxId set and fetch repositoryUrl
      setSandboxCurrentProgress("Loading project code...");
      let repositoryUrl: string | null = null;
      let projectHasSandboxId = false;
      
      // Retry a few times to ensure database update is visible
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const projectResponse = await fetch(`${API_ENDPOINTS.PROJECTS}?projectId=${currentProjectId}`);
          if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            if (projectData.success && projectData.project) {
              if (projectData.project.currentSandboxId === newSandboxId) {
                projectHasSandboxId = true;
              }
              if (projectData.project.repositoryUrl) {
                repositoryUrl = projectData.project.repositoryUrl;
              }
            }
          }
        } catch (error) {
          console.warn("[useSandboxStartup] Error fetching project:", error);
        }
        
        if (projectHasSandboxId) {
          break;
        }
        
        // Wait a bit before retrying (only if not the last attempt)
        if (attempt < 4) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      if (!projectHasSandboxId) {
        console.warn("[useSandboxStartup] Project currentSandboxId not set after sandbox creation, but continuing anyway");
      }

      addSandboxProgressMessage("Project code loaded");
      setSandboxCurrentProgress(null);

      // Step 5: Initialize Expo
      setSandboxCurrentProgress("Initializing Expo server...");
      const initResponse = await fetch(API_ENDPOINTS.INIT_EXPO, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sandboxId: newSandboxId,
          repositoryUrl,
          projectId: currentProjectId,
        }),
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        let errorMessage = `Failed to initialize Expo: ${initResponse.status} ${initResponse.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
          const errorDetails = errorData.logs
            ? `\n\nLogs:\nSTDOUT: ${errorData.logs.stdout?.substring(0, 500)}\nSTDERR: ${errorData.logs.stderr?.substring(0, 500)}`
            : "";
          errorMessage += errorDetails;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      const initData = await initResponse.json();

      if (!initData.success) {
        const errorDetails = initData.logs
          ? `\n\nLogs:\nSTDOUT: ${initData.logs.stdout?.substring(0, 500)}\nSTDERR: ${initData.logs.stderr?.substring(0, 500)}`
          : "";
        throw new Error(
          `Failed to initialize Expo: ${initData.error || "Unknown error"}${errorDetails}`
        );
      }

      // Step 6: Update store state
      setPreviewUrl(initData.previewUrl);
      setSandboxStarted(true);
      addSandboxProgressMessage("Expo server initialized");
      setSandboxCurrentProgress(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setSandboxError(errorMessage);
      setSandboxStarted(false);
      setSandboxCurrentProgress(null);
      throw err;
    } finally {
      setIsStartingSandbox(false);
    }
  }, [
    projectId,
    setSandboxId,
    setPreviewUrl,
    setSandboxStarted,
    addSandboxProgressMessage,
    setSandboxCurrentProgress,
    setSandboxError,
    setIsStartingSandbox,
    clearSandboxProgress,
  ]);

  return {
    startSandbox,
    isStarting: isStartingSandbox,
    error: sandboxError,
    progressMessages: sandboxProgressMessages,
    currentProgress: sandboxCurrentProgress,
  };
}
