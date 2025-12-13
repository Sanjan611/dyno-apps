import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_PROJECT_NAME, API_ENDPOINTS } from "@/lib/constants";
import { useBuilderStore } from "@/lib/store";

interface UseProjectLoaderOptions {
  setProjectId: (id: string | null) => void;
  setProjectName: (name: string) => void;
  setSandboxId: (id: string | null) => void;
  setSandboxStarted: (started: boolean) => void;
  /**
   * Optional reset callback for clearing builder state when starting a new project.
   * This is passed from the builder store so that a fresh project is always created
   * (and corresponding GitHub repo) when visiting /builder without a projectId.
   */
  reset?: () => void;
}

/**
 * Hook for loading project data from URL parameters
 * Only fetches project data - does not create or check sandboxes
 */
export function useProjectLoader({
  setProjectId,
  setProjectName,
  setSandboxId,
  setSandboxStarted,
  reset,
}: UseProjectLoaderOptions) {
  const [sandboxMissing, setSandboxMissing] = useState(false);
  const [isValidatingSandbox, setIsValidatingSandbox] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const projectId = searchParams.get("projectId");
    const sandboxIdParam = searchParams.get("sandboxId");

    if (projectId) {
      // Fetch project data only - no sandbox creation/checking
      const loadProject = async () => {
        try {
          const response = await fetch(`${API_ENDPOINTS.PROJECTS}?projectId=${projectId}`);
          const data = await response.json();

          if (data.success && data.project) {
            setProjectId(data.project.id);
            const projectTitle = data.project.title ?? data.project.name ?? DEFAULT_PROJECT_NAME;
            setProjectName(projectTitle);
            // Don't set sandboxId - sandbox will be started explicitly by user
            setSandboxId(null);
            // Reset sandboxStarted to trigger auto-start on page load
            setSandboxStarted(false);
          } else {
            // Project not found or error
            setSandboxMissing(true);
          }
        } catch (error) {
          console.error("Error loading project:", error);
          setSandboxMissing(true);
        }
      };

      loadProject();
    } else if (sandboxIdParam) {
      // Direct sandboxId provided (legacy support)
      setSandboxId(sandboxIdParam);
    } else {
      // No projectId in URL – treat this as starting a brand new project in the builder.
      // However, don't reset if a project already exists in the store (e.g., from sandbox startup)
      // Check the store to see if projectId is already set
      const currentProjectId = useBuilderStore.getState().projectId;
      
      // Only reset if no project exists yet
      if (!currentProjectId) {
        if (reset) {
          reset();
        } else {
          // Fallback: minimally clear project-specific state
          setProjectId(null);
          setSandboxId(null);
          setProjectName(DEFAULT_PROJECT_NAME);
        }
      }
    }
  }, [searchParams, setProjectId, setProjectName, setSandboxId, setSandboxStarted, reset]);

  return {
    sandboxMissing,
    isValidatingSandbox,
  };
}

