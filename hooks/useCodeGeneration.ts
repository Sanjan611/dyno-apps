import { useCallback } from "react";
import type { Message, AgentAction, AgentActionType, SSEProgressEvent } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";

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

/**
 * Hook for handling code generation via SSE streaming
 * Manages the streaming connection and updates messages with agent actions
 * 
 * Note: Conversation state is now managed server-side, so we don't need to
 * pass conversation history from the frontend.
 */
export function useCodeGeneration() {
  const generateCode = useCallback(
    (
      userPrompt: string,
      projectId: string,
      setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
      abortController?: AbortController
    ): { promise: Promise<void>; abort: () => void } => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      // Create new AbortController if one wasn't provided
      const controller = abortController || new AbortController();
      const abort = () => controller.abort();
      
      const promise = (async () => {

      const response = await fetch(API_ENDPOINTS.PROJECT_CHAT(projectId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userPrompt,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let thinkingMessageId: string | null = null;
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
                  
                case 'complete':
                  setMessages((prev) => {
                    const updated = prev.map((msg) => {
                      if (msg.id === thinkingMessageId) {
                        return {
                          ...msg,
                          actions: msg.actions?.map((action) => ({
                            ...action,
                            status: 'completed' as const,
                          })),
                          isComplete: true,
                        };
                      }
                      return msg;
                    });
                    
                    return [
                      ...updated,
                      {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        content: event.message || "App updated successfully! The changes should be visible in the preview.",
                        timestamp: new Date(),
                      },
                    ];
                  });
                  break;
                  
                case 'error':
                  setMessages((prev) => {
                    const updated = prev.map((msg) => {
                      if (msg.id === thinkingMessageId) {
                        return {
                          ...msg,
                          actions: msg.actions?.map((action) => ({
                            ...action,
                            status: 'completed' as const,
                          })),
                          isComplete: true,
                        };
                      }
                      return msg;
                    });
                    
                    return [
                      ...updated,
                      {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        content: `Error: ${event.error || "Unknown error"}`,
                        timestamp: new Date(),
                      },
                    ];
                  });
                  break;
                  
                case 'stopped':
                  setMessages((prev) => {
                    const updated = prev.map((msg) => {
                      if (msg.id === thinkingMessageId) {
                        return {
                          ...msg,
                          actions: msg.actions?.map((action) => ({
                            ...action,
                            status: 'completed' as const,
                          })),
                          isComplete: true,
                        };
                      }
                      return msg;
                    });
                    
                    return [
                      ...updated,
                      {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        content: "Stopped processing",
                        timestamp: new Date(),
                      },
                    ];
                  });
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
            setMessages((prev) => {
              const updated = prev.map((msg) => {
                if (msg.id === thinkingMessageId) {
                  return {
                    ...msg,
                    actions: msg.actions?.map((action) => ({
                      ...action,
                      status: 'completed' as const,
                    })),
                    isComplete: true,
                  };
                }
                return msg;
              });
              
              return [
                ...updated,
                {
                  id: (Date.now() + 1).toString(),
                  role: "assistant",
                  content: "Stopped processing",
                  timestamp: new Date(),
                },
              ];
            });
          }
        } else {
          throw error;
        }
      } finally {
        reader.releaseLock();
      }
      })();
      
      return { promise, abort };
    },
    []
  );

  return { generateCode };
}

