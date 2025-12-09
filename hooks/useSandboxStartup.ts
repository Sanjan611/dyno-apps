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

      // Step 1: Terminate any existing sandbox
      try {
        await fetch(API_ENDPOINTS.PROJECT_SANDBOX(currentProjectId), {
          method: "DELETE",
        });
        // Don't fail if sandbox doesn't exist - that's fine
      } catch (error) {
        console.warn("[useSandboxStartup] Error terminating existing sandbox:", error);
        // Continue anyway - sandbox might not exist
      }

      // Step 2: Create a new sandbox
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

      // Step 3: Fetch project to get repositoryUrl
      setCurrentProgress("Loading project code...");
      let repositoryUrl: string | null = null;
      try {
        const projectResponse = await fetch(`${API_ENDPOINTS.PROJECTS}?projectId=${currentProjectId}`);
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          if (projectData.success && projectData.project?.repositoryUrl) {
            repositoryUrl = projectData.project.repositoryUrl;
          }
        }
      } catch (error) {
        console.warn("[useSandboxStartup] Error fetching project for repositoryUrl:", error);
        // Continue without repositoryUrl - not critical
      }
      addProgressMessage("Project code loaded");
      setCurrentProgress(null);

      // Step 4: Initialize Expo
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

      // Step 5: Update store state
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

