import { useState, useCallback } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { useBuilderStore } from "@/lib/store";

/**
 * Hook for managing explicit sandbox startup
 * Handles sandbox termination, creation, and Expo initialization
 */
export function useSandboxStartup() {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [currentProgress, setCurrentProgress] = useState<string | null>(null);
  const { setSandboxId, setPreviewUrl, setSandboxStarted, projectId } = useBuilderStore();

  const addProgressMessage = useCallback((message: string) => {
    setProgressMessages((prev) => [...prev, message]);
  }, []);

  const startSandbox = useCallback(async (): Promise<void> => {
    setIsStarting(true);
    setError(null);
    setProgressMessages([]);
    setCurrentProgress(null);

    try {
      // Step 0: Create project if it doesn't exist
      let currentProjectId = projectId;
      const isNewProject = !currentProjectId;
      
      if (!currentProjectId) {
        setCurrentProgress("Creating project...");
        const projectResponse = await fetch(API_ENDPOINTS.PROJECTS, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: null,
            description: null,
            firstMessage: null,
          }),
        });

        if (!projectResponse.ok) {
          const errorText = await projectResponse.text();
          let errorMessage = `Failed to create project: ${projectResponse.status} ${projectResponse.statusText}`;
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

        const projectData = await projectResponse.json();
        if (!projectData.success || !projectData.project?.id) {
          throw new Error(projectData.error || "Failed to create project");
        }

        currentProjectId = projectData.project.id;
        useBuilderStore.getState().setProjectId(currentProjectId);
        addProgressMessage("Project created");
        setCurrentProgress(null);
      }

      // Ensure we have a project ID at this point
      if (!currentProjectId) {
        throw new Error("Project ID is required but was not set");
      }

      // Step 1: Check if existing sandbox is healthy and can be reused
      if (currentProjectId) {
        setCurrentProgress("Checking existing sandbox...");
        try {
          const healthResponse = await fetch(
            API_ENDPOINTS.PROJECT_SANDBOX_HEALTH(currentProjectId)
          );
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            if (healthData.success && healthData.healthy && healthData.previewUrl) {
              // Reuse existing healthy sandbox
              // Ensure projectId is set in store
              useBuilderStore.getState().setProjectId(currentProjectId);
              setSandboxId(healthData.sandboxId);
              setPreviewUrl(healthData.previewUrl);
              setSandboxStarted(true);
              addProgressMessage("Existing sandbox ready");
              setCurrentProgress(null);
              return; // Skip creation
            }
          }
        } catch (error) {
          console.warn("[useSandboxStartup] Error checking sandbox health:", error);
          // Continue with creation flow
        }
        setCurrentProgress(null);
      }

      // Step 2: Terminate any existing sandbox (skip for new projects)
      if (!isNewProject) {
        try {
          await fetch(API_ENDPOINTS.PROJECT_SANDBOX(currentProjectId), {
            method: "DELETE",
          });
          // Don't fail if sandbox doesn't exist - that's fine
        } catch (error) {
          console.warn("[useSandboxStartup] Error terminating existing sandbox:", error);
          // Continue anyway - sandbox might not exist
        }
      }

      // Step 3: Create a new sandbox
      setCurrentProgress("Creating sandbox...");
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
      addProgressMessage("Sandbox created");
      setCurrentProgress(null);

      // Step 4: Verify project has currentSandboxId set and fetch repositoryUrl
      setCurrentProgress("Loading project code...");
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
      
      addProgressMessage("Project code loaded");
      setCurrentProgress(null);

      // Step 5: Initialize Expo
      setCurrentProgress("Initializing Expo server...");
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
      // Ensure projectId is set in store (important for new projects)
      useBuilderStore.getState().setProjectId(currentProjectId);
      setPreviewUrl(initData.previewUrl);
      setSandboxStarted(true);
      addProgressMessage("Expo server initialized");
      setCurrentProgress(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setSandboxStarted(false);
      setCurrentProgress(null);
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, [projectId, setSandboxId, setPreviewUrl, setSandboxStarted, addProgressMessage]);

  return {
    startSandbox,
    isStarting,
    error,
    progressMessages,
    currentProgress,
  };
}

