"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, Terminal, RefreshCw, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useBuilderStore } from "@/lib/store";
import AgentThinkingBox, { AgentAction } from "./AgentThinkingBox";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  initialPrompt?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "thinking";
  content: string;
  timestamp: Date;
  actions?: AgentAction[];
  isComplete?: boolean;
}

interface SSEProgressEvent {
  type: 'status' | 'coding_iteration' | 'todo_update' | 'complete' | 'error';
  message?: string;
  iteration?: number;
  tool?: string;
  todo?: string;
  todos?: Array<{
    content: string;
    activeForm: string;
    status: string;
  }>;
  error?: string;
  details?: any;
  files?: Record<string, string>;
}

// Helper function to map tool names to user-friendly action types
function getActionTypeFromTool(toolName: string): AgentAction['type'] {
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

// Helper function to consume the code generation SSE stream
async function consumeCodeGenerationStream(
  userPrompt: string,
  sandboxId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
): Promise<void> {
  const response = await fetch("/api/generate-code-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userPrompt,
      sandboxId,
    }),
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
          }
        } catch (parseError) {
          console.error("Error parsing SSE event:", parseError, "Event data:", eventData);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export default function ChatPanel({ initialPrompt }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm your AI assistant. Describe the mobile app you'd like to build, and I'll help you create it.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [logs, setLogs] = useState<any>(null);
  const { setSandboxId, setPreviewUrl, setExpoConnectionUrl, sandboxId, setProjectId, projectId } = useBuilderStore();
  const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
  const hasAutoSubmitted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (rawContent: string) => {
      const content = rawContent.trim();
      if (!content) return;

      const newMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newMessage]);

      const isFirstMessage = !hasSentInitialMessage;
      if (isFirstMessage) {
        setHasSentInitialMessage(true);
      }

      if (isFirstMessage) {
        setIsLoading(true);
        try {
          let currentProjectId = projectId;
          let currentSandboxId = sandboxId;

          // If no project exists, create one first
          if (!currentProjectId) {
            const saveResponse = await fetch("/api/projects", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: null, // Will be extracted from firstMessage
                description: null, // Will use firstMessage
                firstMessage: newMessage.content,
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

          // Get or create sandbox for the project
          const sandboxResponse = await fetch(
            `/api/projects/${currentProjectId}/sandbox`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          const sandboxData = await sandboxResponse.json();

          if (sandboxData.success) {
            currentSandboxId = sandboxData.sandboxId;
            setSandboxId(currentSandboxId);
            
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

            // Initialize Expo in the sandbox
            try {
              const initResponse = await fetch("/api/init-expo", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ sandboxId: currentSandboxId }),
              });

              const initData = await initResponse.json();

              if (initData.success) {
                setPreviewUrl(initData.previewUrl);
                if (initData.expoConnectionUrl) {
                  setExpoConnectionUrl(initData.expoConnectionUrl);
                }
                const expoMessage: Message = {
                  id: (Date.now() + 2).toString(),
                  role: "assistant",
                  content: `Expo application initialized! Generating your app code...`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, expoMessage]);

                // Call the coding agent to generate/modify App.js using SSE streaming
                try {
                  if (!currentSandboxId) {
                    throw new Error("Sandbox ID is not available");
                  }
                  await consumeCodeGenerationStream(
                    newMessage.content,
                    currentSandboxId,
                    setMessages
                  );
                } catch (error) {
                  const errorMessage: Message = {
                    id: (Date.now() + 3).toString(),
                    role: "assistant",
                    content: `Error generating code: ${error instanceof Error ? error.message : "Unknown error"}`,
                    timestamp: new Date(),
                  };
                  setMessages((prev) => [...prev, errorMessage]);
                }
              } else {
                const errorDetails = initData.logs
                  ? `\n\nLogs:\nSTDOUT: ${initData.logs.stdout?.substring(0, 500)}\nSTDERR: ${initData.logs.stderr?.substring(0, 500)}`
                  : "";
                const errorMessage: Message = {
                  id: (Date.now() + 2).toString(),
                  role: "assistant",
                  content: `Failed to initialize Expo: ${initData.error || "Unknown error"}${errorDetails}`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, errorMessage]);
              }
            } catch (error) {
              const errorMessage: Message = {
                id: (Date.now() + 2).toString(),
                role: "assistant",
                content: `Error initializing Expo: ${error instanceof Error ? error.message : "Unknown error"}`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, errorMessage]);
            }
          } else {
            throw new Error(sandboxData.error || "Failed to create/get sandbox");
          }
        } catch (error) {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Error setting up project: ${error instanceof Error ? error.message : "Unknown error"}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Subsequent messages: just call the coding agent
      if (!sandboxId) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Error: No sandbox available. Please refresh the page and try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      setIsLoading(true);
      try {
        await consumeCodeGenerationStream(
          newMessage.content,
          sandboxId,
          setMessages
        );
      } catch (error) {
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: `Error updating app: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      hasSentInitialMessage,
      sandboxId,
      projectId,
      setProjectId,
      setPreviewUrl,
      setSandboxId,
      setMessages,
    ]
  );

  const handleSend = async () => {
    if (!input.trim()) return;
    const message = input;
    setInput("");
    await sendMessage(message);
  };

  useEffect(() => {
    const prompt = initialPrompt?.trim();
    if (!prompt || hasAutoSubmitted.current) return;

    hasAutoSubmitted.current = true;
    sendMessage(prompt);
  }, [initialPrompt, sendMessage]);

  return (
    <div className="flex flex-col h-full bg-white relative">
      <CardHeader className="px-6 py-4 border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Dyno</CardTitle>
            <CardDescription className="text-xs mt-1">
              Describe your app ideas naturally
            </CardDescription>
          </div>
          {sandboxId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                setViewingLogs(true);
                try {
                  const response = await fetch(
                    `/api/sandbox-logs?sandboxId=${sandboxId}`
                  );
                  const data = await response.json();
                  setLogs(data);
                } catch (error) {
                  console.error("Error fetching logs:", error);
                } finally {
                  setViewingLogs(false);
                }
              }}
              disabled={viewingLogs}
              title="View Logs"
              className="hover:bg-slate-100"
            >
              {viewingLogs ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </CardHeader>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 relative"
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.4] pointer-events-none" />
        {logs && logs.success && (
          <div className="mb-6 p-4 bg-black/90 text-green-400 rounded-xl font-mono text-xs overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 relative z-10">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <div className="font-bold flex items-center gap-2">
                 <Terminal className="w-3 h-3" /> Sandbox Logs
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogs(null)}
                className="h-6 px-2 text-white/50 hover:text-white hover:bg-white/10"
              >
                Close
              </Button>
            </div>
            <div className="overflow-auto max-h-60 space-y-4">
              {logs.logs.expoLogs && (
                <div>
                  <div className="font-bold text-white/70 mb-1">Expo Output:</div>
                  <pre className="whitespace-pre-wrap">{logs.logs.expoLogs}</pre>
                </div>
              )}
              {logs.logs.processCheck && (
                <div>
                   <div className="font-bold text-white/70 mb-1">Processes:</div>
                   <pre className="whitespace-pre-wrap">{logs.logs.processCheck}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {messages.map((message) => {
          if (message.role === "thinking") {
            return (
              <div key={message.id} className="flex justify-start animate-in fade-in slide-in-from-left-2 relative z-10">
                 <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-3 flex-shrink-0 shadow-sm">
                    <Sparkles className="w-4 h-4 text-primary" />
                 </div>
                <div className="max-w-[85%] w-full">
                  <AgentThinkingBox
                    actions={message.actions || []}
                    isComplete={message.isComplete || false}
                  />
                </div>
              </div>
            );
          }
          
          const isUser = message.role === "user";
          
          return (
            <div
              key={message.id}
              className={cn(
                "flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 relative z-10",
                isUser ? "justify-end" : "justify-start"
              )}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shadow-md mb-1">
                  AI
                </div>
              )}
              
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                  isUser
                    ? "bg-gradient-to-r from-primary to-secondary text-white rounded-br-none"
                    : "bg-white border border-slate-100 text-slate-700 rounded-bl-none"
                )}
              >
                <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap">
                  {message.content}
                </div>
                <p className={cn(
                  "text-[10px] mt-1",
                  isUser ? "text-white/70" : "text-slate-400"
                )}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        
        {isLoading && !messages.some(m => m.role === "thinking" && !m.isComplete) && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm pl-12 animate-pulse relative z-10">
             <Sparkles className="w-3 h-3" />
             Thinking...
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-white mt-auto relative z-10">
        <div className="relative flex items-center">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="pr-12 py-6 rounded-full border-slate-200 bg-slate-50 focus:bg-white focus:border-primary/30 focus:ring-primary/20 shadow-inner"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSend} 
            size="icon" 
            disabled={isLoading || !input.trim()}
            className="absolute right-1.5 h-9 w-9 rounded-full bg-primary hover:bg-primary/90 transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-xs text-center text-muted-foreground mt-2">
           AI can make mistakes. Check the code.
        </div>
      </div>
    </div>
  );
}
