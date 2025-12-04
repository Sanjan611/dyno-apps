import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_PROJECT_NAME, API_ENDPOINTS } from "@/lib/constants";

interface UseProjectLoaderOptions {
  setProjectId: (id: string | null) => void;
  setProjectName: (name: string) => void;
  setSandboxId: (id: string | null) => void;
  /**
   * Optional reset callback for clearing builder state when starting a new project.
   * This is passed from the builder store so that a fresh project is always created
   * (and corresponding GitHub repo) when visiting /builder without a projectId.
   */
  reset?: () => void;
}

/**
 * Hook for loading project data from URL parameters
 * Handles project fetching, sandbox health checks, and sandbox creation
 */
export function useProjectLoader({
  setProjectId,
  setProjectName,
  setSandboxId,
  reset,
}: UseProjectLoaderOptions) {
  const [sandboxMissing, setSandboxMissing] = useState(false);
  const [isValidatingSandbox, setIsValidatingSandbox] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const projectId = searchParams.get("projectId");
    const sandboxIdParam = searchParams.get("sandboxId");

    if (projectId) {
      // Fetch project data
      const loadProject = async () => {
        try {
          const response = await fetch(`${API_ENDPOINTS.PROJECTS}?projectId=${projectId}`);
          const data = await response.json();

          if (data.success && data.project) {
            setProjectId(data.project.id);
            const projectTitle = data.project.title ?? data.project.name ?? DEFAULT_PROJECT_NAME;
            setProjectName(projectTitle);
            const projectSandboxId =
              data.project.currentSandboxId ?? data.project.sandboxId ?? null;
            setSandboxId(projectSandboxId);

            // Check sandbox health and create if needed
            setIsValidatingSandbox(true);
            try {
              // First check health
              const healthResponse = await fetch(
                API_ENDPOINTS.PROJECT_SANDBOX_HEALTH(projectId)
              );
              const healthData = await healthResponse.json();

              if (healthData.success) {
                if (!healthData.exists || !healthData.healthy) {
                  // Sandbox doesn't exist or is unhealthy, create/get a new one
                  const sandboxResponse = await fetch(
                    API_ENDPOINTS.PROJECT_SANDBOX(projectId),
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                    }
                  );
                  const sandboxData = await sandboxResponse.json();

                  if (sandboxData.success) {
                    setSandboxId(sandboxData.sandboxId);
                  } else {
                    setSandboxMissing(true);
                  }
                } else {
                  // Sandbox is healthy, use existing one
                  setSandboxId(projectSandboxId);
                }
              } else {
                // Health check failed, try to create sandbox
                const sandboxResponse = await fetch(
                  API_ENDPOINTS.PROJECT_SANDBOX(projectId),
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                  }
                );
                const sandboxData = await sandboxResponse.json();

                if (sandboxData.success) {
                  setSandboxId(sandboxData.sandboxId);
                } else {
                  setSandboxMissing(true);
                }
              }
            } catch (error) {
              console.error("Error checking/creating sandbox:", error);
              // Try to create sandbox as fallback
              try {
                const sandboxResponse = await fetch(
                  API_ENDPOINTS.PROJECT_SANDBOX(projectId),
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                  }
                );
                const sandboxData = await sandboxResponse.json();
                if (sandboxData.success) {
                  setSandboxId(sandboxData.sandboxId);
                } else {
                  setSandboxMissing(true);
                }
              } catch (fallbackError) {
                setSandboxMissing(true);
              }
            } finally {
              setIsValidatingSandbox(false);
            }
          }
        } catch (error) {
          console.error("Error loading project:", error);
        }
      };

      loadProject();
    } else if (sandboxIdParam) {
      // Direct sandboxId provided
      setSandboxId(sandboxIdParam);
    } else {
      // No projectId in URL – treat this as starting a brand new project in the builder.
      // Clear any persisted builder state so that initializeProject POSTs /api/projects,
      // which in turn creates the backing GitHub repository.
      if (reset) {
        reset();
      } else {
        // Fallback: minimally clear project-specific state
        setProjectId(null);
        setSandboxId(null);
        setProjectName(DEFAULT_PROJECT_NAME);
      }
    }
  }, [searchParams, setProjectId, setProjectName, setSandboxId, reset]);

  return {
    sandboxMissing,
    isValidatingSandbox,
  };
}

