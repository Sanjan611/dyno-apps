import { useCallback } from "react";
import type { Message } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";

interface UseProjectSessionOptions {
  projectId: string | null;
  sandboxId: string | null;
  setProjectId: (id: string | null) => void;
  setSandboxId: (id: string | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

/**
 * Hook for managing project and sandbox session initialization
 * Handles project creation, sandbox setup, and Expo initialization
 */
export function useProjectSession({
  projectId,
  sandboxId,
  setProjectId,
  setSandboxId,
  setPreviewUrl,
  setMessages,
}: UseProjectSessionOptions) {
  const initializeProject = useCallback(
    async (firstMessage: Message): Promise<{ projectId: string; sandboxId: string }> => {
      let currentProjectId = projectId;
      let currentSandboxId = sandboxId;

      // If no project exists, create one first
      if (!currentProjectId) {
        const saveResponse = await fetch(API_ENDPOINTS.PROJECTS, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: null, // Will be extracted from firstMessage
            description: null, // Will use firstMessage
            firstMessage: firstMessage.content,
          }),
        });

        const saveData = await saveResponse.json();
        if (saveData.success && saveData.project) {
          currentProjectId = saveData.project.id;
          setProjectId(currentProjectId);
        } else {
          throw new Error(saveData.error || "Failed to create project");
        }
      }

      // Ensure we have a project ID at this point
      if (!currentProjectId) {
        throw new Error("Project ID is required but was not set");
      }

      // TypeScript now knows currentProjectId is string after the null check
      const projectIdString: string = currentProjectId;

      // Get or create sandbox for the project
      const sandboxResponse = await fetch(
        API_ENDPOINTS.PROJECT_SANDBOX(projectIdString),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const sandboxData = await sandboxResponse.json();

      if (!sandboxData.success) {
        throw new Error(sandboxData.error || "Failed to create/get sandbox");
      }

      currentSandboxId = sandboxData.sandboxId;
      
      if (!currentSandboxId) {
        throw new Error("Sandbox ID is required but was not returned");
      }

      const sandboxIdString: string = currentSandboxId;
      setSandboxId(sandboxIdString);
      
      const sandboxMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          sandboxData.status === "reused"
            ? `Using existing sandbox. Initializing Expo application...`
            : `Sandbox created successfully! Initializing Expo application...`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, sandboxMessage]);

      return { projectId: projectIdString, sandboxId: sandboxIdString };
    },
    [projectId, sandboxId, setProjectId, setSandboxId, setMessages]
  );

  const initializeExpo = useCallback(
    async (sandboxId: string): Promise<string> => {
      const initResponse = await fetch(API_ENDPOINTS.INIT_EXPO, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sandboxId }),
      });

      const initData = await initResponse.json();

      if (!initData.success) {
        const errorDetails = initData.logs
          ? `\n\nLogs:\nSTDOUT: ${initData.logs.stdout?.substring(0, 500)}\nSTDERR: ${initData.logs.stderr?.substring(0, 500)}`
          : "";
        throw new Error(
          `Failed to initialize Expo: ${initData.error || "Unknown error"}${errorDetails}`
        );
      }

      setPreviewUrl(initData.previewUrl);
      
      const expoMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Expo application initialized! Generating your app code...`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, expoMessage]);

      return initData.previewUrl;
    },
    [setPreviewUrl, setMessages]
  );

  return {
    initializeProject,
    initializeExpo,
  };
}

