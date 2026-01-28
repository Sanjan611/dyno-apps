import { useCallback, useState, useEffect, useRef } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { Message, AgentAction, AgentActionType, SSEProgressEvent, MessageMode } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { useBuilderStore } from "@/lib/store";
import type { codingAgentTask } from "@/trigger/coding-agent";
import type { askAgentTask } from "@/trigger/ask-agent";
import type { AgentMetadata } from "@/trigger/coding-agent";

/**
 * Finalizes a thinking message by storing the reply content directly in the thinking message
 * This unifies the thinking box and reply into a single message block
 * Used for complete, error, and stopped events
 */
function finalizeThinkingMessage(
  prev: Message[],
  thinkingId: string | null,
  finalContent: string
): Message[] {
  return prev.map((msg) => {
    if (msg.id === thinkingId) {
      return {
        ...msg,
        actions: msg.actions?.map((action) => ({
          ...action,
          status: 'completed' as const,
        })),
        isComplete: true,
        replyContent: finalContent,
      };
    }
    return msg;
  });
}

// Helper function to map tool names to user-friendly action types
function getActionTypeFromTool(toolName: string): AgentActionType {
  if (toolName.includes('list_files')) return 'list_files';
  if (toolName.includes('read_file')) return 'read_file';
  if (toolName.includes('write_file')) return 'write_file';
  if (toolName.includes('todo_write')) return 'todo';
  if (toolName.includes('parallel_read')) return 'parallel_read';
  return 'status';
}

// Helper function to create user-friendly description from tool and event
function createActionDescription(
  event: SSEProgressEvent,
  actionType: AgentAction['type']
): string {
  switch (actionType) {
    case 'status':
      return event.message || 'Processing...';
    case 'list_files':
      return 'Exploring project structure...';
    case 'read_file':
      // Extract filename from todo field (route.ts sets it to "Reading ${filePath}")
      if (event.todo && event.todo.startsWith('Reading')) {
        return event.todo;
      }
      return 'Reading file...';
    case 'write_file':
      // Extract filename from todo field (route.ts sets it to "Writing ${filePath}")
      if (event.todo && event.todo.startsWith('Writing')) {
        return event.todo;
      }
      // Fallback to tool name
      if (event.tool && event.tool.includes('write_file')) {
        return 'Writing file...';
      }
      return 'Writing file...';
    case 'parallel_read':
      // Extract count from tool name like "parallel_read (3 files)"
      if (event.tool && event.tool.includes('parallel_read')) {
        const match = event.tool.match(/parallel_read\s*\((\d+)\s*files?\)/);
        if (match) {
          return `Reading ${match[1]} files...`;
        }
      }
      return 'Reading multiple files...';
    case 'todo':
      if (event.todo) {
        return `Planning: ${event.todo}`;
      }
      if (event.todos && event.todos.length > 0) {
        const inProgressTodo = event.todos.find(t => t.status === 'in_progress');
        if (inProgressTodo) {
          return `Planning: ${inProgressTodo.content}`;
        }
      }
      return 'Updating plan...';
    default:
      return event.tool || 'Processing...';
  }
}

// Helper function to parse SSE stream
function parseSSEEvents(chunk: string): string[] {
  const events: string[] = [];
  const lines = chunk.split('\n');
  let currentEvent = '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      if (currentEvent) {
        events.push(currentEvent);
      }
      currentEvent = line.substring(6); // Remove 'data: ' prefix
    } else if (line.trim() === '' && currentEvent) {
      events.push(currentEvent);
      currentEvent = '';
    } else if (currentEvent) {
      currentEvent += '\n' + line;
    }
  }

  if (currentEvent) {
    events.push(currentEvent);
  }

  return events;
}

// Helper function to map Trigger.dev metadata status to action type
function getActionTypeFromTriggerStatus(metadata: AgentMetadata): AgentActionType {
  if (!metadata.currentTool) return 'status';

  const tool = metadata.currentTool;
  if (tool === 'list_files') return 'list_files';
  if (tool === 'read_file') return 'read_file';
  if (tool === 'read_files') return 'parallel_read';
  if (tool === 'write_file') return 'write_file';
  if (tool === 'edit_file') return 'write_file';
  if (tool === 'todo_write') return 'todo';
  return 'status';
}

/**
 * Hook for handling code generation via SSE streaming or Trigger.dev
 * Manages the streaming connection and updates messages with agent actions
 *
 * Supports two modes:
 * - SSE streaming (default): Traditional server-sent events
 * - Trigger.dev (when USE_TRIGGER_DEV=true on server): Real-time updates via Trigger.dev
 *
 * Note: Conversation state is now managed server-side, so we don't need to
 * pass conversation history from the frontend.
 */
export function useCodeGeneration() {
  // Trigger.dev state
  const [triggerRunId, setTriggerRunId] = useState<string | null>(null);
  const [triggerAccessToken, setTriggerAccessToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Refs to track state across renders for Trigger.dev updates
  const thinkingMessageIdRef = useRef<string | null>(null);
  const setMessagesRef = useRef<React.Dispatch<React.SetStateAction<Message[]>> | null>(null);
  const lastMetadataRef = useRef<string | null>(null);
  const projectIdRef = useRef<string | null>(null);

  // Subscribe to Trigger.dev run updates (only active when triggerRunId is set)
  // Supports both coding and ask agent tasks (they share the same AgentMetadata structure)
  const { run, error: triggerError } = useRealtimeRun<typeof codingAgentTask | typeof askAgentTask>(triggerRunId ?? undefined, {
    accessToken: triggerAccessToken ?? undefined,
    enabled: !!triggerRunId && !!triggerAccessToken,
  });

  // Handle Trigger.dev run updates
  useEffect(() => {
    if (!run || !setMessagesRef.current) return;

    const setMessages = setMessagesRef.current;
    const metadata = run.metadata as AgentMetadata | undefined;

    // Handle terminal states FIRST (before metadata early-return)
    // This ensures completion/failure is always handled even if metadata doesn't change
    if (run.status === 'COMPLETED') {
      // Extract message from output if available, otherwise use default
      let finalMessage = "App updated successfully! The changes should be visible in the preview.";
      if (run.output) {
        const output = run.output as { success: boolean; message?: string; error?: string };
        finalMessage = output.success
          ? output.message || finalMessage
          : `Error: ${output.error || "Unknown error"}`;
      }

      // Use setTimeout to ensure any pending state updates from metadata changes are processed first
      // This fixes a race condition where finalization runs before the last action is added
      const thinkingId = thinkingMessageIdRef.current;
      setTimeout(() => {
        if (setMessagesRef.current) {
          setMessagesRef.current((prev) =>
            finalizeThinkingMessage(prev, thinkingId, finalMessage)
          );
        }
      }, 0);

      // Reset Trigger.dev state
      setTriggerRunId(null);
      setTriggerAccessToken(null);
      setIsGenerating(false);
      thinkingMessageIdRef.current = null;
      lastMetadataRef.current = null;
      return;
    }

    if (run.status === 'FAILED' || run.status === 'CANCELED') {
      const errorMessage = run.status === 'CANCELED'
        ? "Stopped processing"
        : `Error: ${triggerError?.message || "Task failed"}`;

      // Use setTimeout to ensure any pending state updates are processed first
      const thinkingId = thinkingMessageIdRef.current;
      setTimeout(() => {
        if (setMessagesRef.current) {
          setMessagesRef.current((prev) =>
            finalizeThinkingMessage(prev, thinkingId, errorMessage)
          );
        }
      }, 0);

      // Reset Trigger.dev state
      setTriggerRunId(null);
      setTriggerAccessToken(null);
      setIsGenerating(false);
      thinkingMessageIdRef.current = null;
      lastMetadataRef.current = null;
      return;
    }

    // For non-terminal states, skip if metadata hasn't changed
    const metadataKey = JSON.stringify(metadata);
    if (metadataKey === lastMetadataRef.current) return;
    lastMetadataRef.current = metadataKey;

    if (!metadata) return;

    // Create thinking message if it doesn't exist
    if (!thinkingMessageIdRef.current && metadata.status !== 'complete' && metadata.status !== 'error') {
      thinkingMessageIdRef.current = Date.now().toString();
      setMessages((prev) => [
        ...prev,
        {
          id: thinkingMessageIdRef.current!,
          role: "thinking",
          content: "",
          timestamp: new Date(),
          actions: [],
          isComplete: false,
        },
      ]);
    }

    // Handle status updates - only create actions for actual tool executions
    // Skip status-only messages (like "Agent working...") that don't have a toolDescription
    if (metadata.status === 'executing_tool' && metadata.toolDescription) {
      const actionType = getActionTypeFromTriggerStatus(metadata);
      const description = metadata.toolDescription;

      if (thinkingMessageIdRef.current) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== thinkingMessageIdRef.current) return msg;

            const existingActions = msg.actions || [];

            // Check for duplicate
            const duplicateAction = existingActions.find(
              (action) => action.description === description && action.status === 'in_progress'
            );
            if (duplicateAction) return msg;

            // Mark previous in_progress actions as completed
            const updatedActions = existingActions.map((action) =>
              action.status === 'in_progress'
                ? { ...action, status: 'completed' as const }
                : action
            );

            const newAction: AgentAction = {
              id: `${Date.now()}-${Math.random()}`,
              type: actionType,
              description,
              timestamp: new Date(),
              status: 'in_progress',
            };

            return {
              ...msg,
              actions: [...updatedActions, newAction],
            };
          })
        );
      }
    }
  }, [run, triggerError]);

  const generateCode = useCallback(
    (
      userPrompt: string,
      projectId: string,
      setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
      mode: MessageMode = 'build',
      abortController?: AbortController,
      existingThinkingMessageId?: string
    ): { promise: Promise<void>; abort: () => void } => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      // Store refs for Trigger.dev updates and cancellation
      setMessagesRef.current = setMessages;
      projectIdRef.current = projectId;

      // Create new AbortController if one wasn't provided
      const controller = abortController || new AbortController();
      const abort = () => controller.abort();

      const promise = (async () => {
        setIsGenerating(true);

        const response = await fetch(API_ENDPOINTS.PROJECT_CHAT(projectId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userPrompt,
            mode,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // Try to parse error from JSON response
          const contentType = response.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Check if this is a Trigger.dev response (JSON) or SSE stream
        const contentType = response.headers.get("content-type");

        if (contentType?.includes("application/json")) {
          // ============================================================
          // Trigger.dev Path - Subscribe to real-time updates
          // ============================================================
          const data = await response.json();

          if (data.runId && data.publicAccessToken) {
            console.log("[useCodeGeneration] Trigger.dev response, subscribing to run:", data.runId);

            // Handle generated title if present
            if (data.generatedTitle) {
              useBuilderStore.getState().setProjectName(data.generatedTitle);
            }

            // Use existing thinking message ID if provided (optimistic UI from ChatPanel)
            if (existingThinkingMessageId) {
              thinkingMessageIdRef.current = existingThinkingMessageId;
            }

            // Set Trigger.dev state to start subscription
            setTriggerRunId(data.runId);
            setTriggerAccessToken(data.publicAccessToken);

            // The useRealtimeRun hook will handle updates via the useEffect above
            // We return here - the promise resolves but updates continue via the hook
            return;
          } else {
            throw new Error("Invalid Trigger.dev response: missing runId or publicAccessToken");
          }
        }

        // ============================================================
        // SSE Path - Original implementation
        // ============================================================
        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Use existing thinking message ID if provided (optimistic UI from ChatPanel)
        let thinkingMessageId: string | null = existingThinkingMessageId || null;
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // Check if request was aborted
            if (controller.signal.aborted) {
              reader.cancel();
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Try to parse complete SSE events
            const events = parseSSEEvents(buffer);

            // Keep incomplete events in buffer
            const lastNewlineIndex = buffer.lastIndexOf('\n\n');
            if (lastNewlineIndex !== -1) {
              buffer = buffer.substring(lastNewlineIndex + 2);
            } else {
              // Check if we have a partial event
              const lastDataIndex = buffer.lastIndexOf('data: ');
              if (lastDataIndex !== -1) {
                buffer = buffer.substring(lastDataIndex);
              }
            }

            for (const eventData of events) {
              if (!eventData.trim()) continue;

              try {
                const event: SSEProgressEvent = JSON.parse(eventData);

                switch (event.type) {
                  case 'status':
                    if (event.message) {
                      // Skip backend infrastructure status messages - these are not agent actions
                      const infrastructureMessages = [
                        'Initializing sandbox connection...',
                      ];

                      if (infrastructureMessages.includes(event.message)) {
                        break;
                      }
                      break;
                    }
                    break;

                  case 'agent_started':
                    // Thinking box is now created optimistically in ChatPanel
                    // Only create here as fallback if not already created
                    if (!thinkingMessageId) {
                      thinkingMessageId = Date.now().toString();
                      setMessages((prev) => [
                        ...prev,
                        {
                          id: thinkingMessageId!,
                          role: "thinking",
                          content: "",
                          timestamp: new Date(),
                          actions: [{
                            id: `${Date.now()}-initial`,
                            type: 'status' as AgentActionType,
                            description: event.message || 'Analyzing your request...',
                            timestamp: new Date(),
                            status: 'in_progress',
                          }],
                          isComplete: false,
                        },
                      ]);
                    }
                    // If thinking message already exists (optimistic UI), the initial action
                    // is already showing - we just continue with updates
                    break;

                  case 'coding_iteration':
                    if (event.todo || event.tool) {
                      // Skip invalid actions
                      if (event.tool?.includes('parallel_read') && event.tool.includes('(0 files)')) {
                        break;
                      }

                      // Create thinking message if it doesn't exist
                      if (!thinkingMessageId) {
                        thinkingMessageId = Date.now().toString();
                        setMessages((prev) => [
                          ...prev,
                          {
                            id: thinkingMessageId!,
                            role: "thinking",
                            content: "",
                            timestamp: new Date(),
                            actions: [],
                            isComplete: false,
                          },
                        ]);
                      }

                      const actionType = getActionTypeFromTool(event.tool || '');
                      const description = createActionDescription(event, actionType);

                      if (description.includes('0 files')) {
                        break;
                      }

                      if ((description === 'Reading file...' || description === 'Writing file...') && !event.todo) {
                        break;
                      }

                      setMessages((prev) =>
                        prev.map((msg) => {
                          if (msg.id !== thinkingMessageId) return msg;

                          const existingActions = msg.actions || [];

                          const duplicateAction = existingActions.find(
                            (action) => action.description === description && action.status === 'in_progress'
                          );
                          if (duplicateAction) {
                            return msg;
                          }

                          const updatedActions = existingActions.map((action) =>
                            action.status === 'in_progress'
                              ? { ...action, status: 'completed' as const }
                              : action
                          );

                          const newAction: AgentAction = {
                            id: `${Date.now()}-${Math.random()}`,
                            type: actionType,
                            description,
                            timestamp: new Date(),
                            status: 'in_progress',
                          };

                          return {
                            ...msg,
                            actions: [...updatedActions, newAction],
                          };
                        })
                      );
                    }
                    break;

                  case 'todo_update':
                    break;

                  case 'title_updated':
                    if (event.title) {
                      // Update project name in Zustand store
                      useBuilderStore.getState().setProjectName(event.title);
                    }
                    break;

                  case 'complete':
                    setMessages((prev) =>
                      finalizeThinkingMessage(
                        prev,
                        thinkingMessageId,
                        event.message || "App updated successfully! The changes should be visible in the preview."
                      )
                    );
                    break;

                  case 'error':
                    setMessages((prev) =>
                      finalizeThinkingMessage(
                        prev,
                        thinkingMessageId,
                        `Error: ${event.error || "Unknown error"}`
                      )
                    );
                    break;

                  case 'stopped':
                    setMessages((prev) =>
                      finalizeThinkingMessage(
                        prev,
                        thinkingMessageId,
                        "Stopped processing"
                      )
                    );
                    break;
                }
              } catch (parseError) {
                console.error("Error parsing SSE event:", parseError, "Event data:", eventData);
              }
            }
          }
        } catch (error) {
          // Handle abort errors
          if (error instanceof Error && error.name === 'AbortError') {
            // Request was aborted - the backend should have sent a 'stopped' event
            // If we didn't receive it, handle it here
            if (thinkingMessageId) {
              setMessages((prev) =>
                finalizeThinkingMessage(
                  prev,
                  thinkingMessageId,
                  "Stopped processing"
                )
              );
            }
          } else {
            throw error;
          }
        } finally {
          reader.releaseLock();
          setIsGenerating(false);
        }
      })();

      return { promise, abort };
    },
    []
  );

  // Cancel a Trigger.dev run
  const cancelGeneration = useCallback(async () => {
    if (!triggerRunId || !projectIdRef.current) {
      console.log("[useCodeGeneration] No active Trigger.dev run to cancel");
      return;
    }

    console.log("[useCodeGeneration] Cancelling Trigger.dev run:", triggerRunId);

    try {
      const response = await fetch(
        API_ENDPOINTS.PROJECT_CHAT_CANCEL(projectIdRef.current),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ runId: triggerRunId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[useCodeGeneration] Failed to cancel run:", errorData);
      } else {
        console.log("[useCodeGeneration] Successfully cancelled, updating UI");

        // Immediately update UI - don't wait for real-time subscription
        if (setMessagesRef.current) {
          setMessagesRef.current((prev) =>
            finalizeThinkingMessage(prev, thinkingMessageIdRef.current, "Stopped processing")
          );
        }

        // Reset Trigger.dev state
        setTriggerRunId(null);
        setTriggerAccessToken(null);
        setIsGenerating(false);
        thinkingMessageIdRef.current = null;
        lastMetadataRef.current = null;
      }
    } catch (error) {
      console.error("[useCodeGeneration] Error cancelling run:", error);
    }
  }, [triggerRunId]);

  return { generateCode, cancelGeneration, isGenerating, triggerRunId };
}

