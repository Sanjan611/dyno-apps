"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBuilderStore } from "@/lib/store";

interface ChatPanelProps {
  initialPrompt?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
  const { setSandboxId, setPreviewUrl, sandboxId, setProjectId, projectId } = useBuilderStore();
  const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
  const hasAutoSubmitted = useRef(false);

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
                const expoMessage: Message = {
                  id: (Date.now() + 2).toString(),
                  role: "assistant",
                  content: `Expo application initialized! Generating your app code...`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, expoMessage]);

                // Call the coding agent to generate/modify App.js
                try {
                  const codeResponse = await fetch("/api/generate-code", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      userPrompt: newMessage.content,
                      sandboxId: currentSandboxId,
                    }),
                  });

                  const codeData = await codeResponse.json();

                  if (codeData.success) {
                    const newMessages: Message[] = [];
                    
                    // Add planning message if present
                    if (codeData.planningMessage) {
                      newMessages.push({
                        id: (Date.now() + 2).toString(),
                        role: "assistant",
                        content: codeData.planningMessage,
                        timestamp: new Date(),
                      });
                    }
                    
                    // Add success message
                    newMessages.push({
                      id: (Date.now() + 3).toString(),
                      role: "assistant",
                      content: codeData.message || `App code generated successfully! Your app is now ready. Check the preview panel to see it.`,
                      timestamp: new Date(),
                    });
                    
                    setMessages((prev) => [...prev, ...newMessages]);
                  } else {
                    const errorMessage: Message = {
                      id: (Date.now() + 3).toString(),
                      role: "assistant",
                      content: `Failed to generate code: ${codeData.error || "Unknown error"}`,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, errorMessage]);
                  }
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
      const thinkingMessageId = (Date.now() + 1).toString();
      const thinkingMessage: Message = {
        id: thinkingMessageId,
        role: "assistant",
        content: "Updating your app...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, thinkingMessage]);

      try {
        const codeResponse = await fetch("/api/generate-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userPrompt: newMessage.content,
            sandboxId: sandboxId,
          }),
        });

        const codeData = await codeResponse.json();

        if (codeData.success) {
          // Remove the "thinking" message
          setMessages((prev) => {
            const filtered = prev.filter((msg) => msg.id !== thinkingMessageId);
            const newMessages = [...filtered];
            
            // Add planning message if present
            if (codeData.planningMessage) {
              newMessages.push({
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: codeData.planningMessage,
                timestamp: new Date(),
              });
            }
            
            // Add success message
            newMessages.push({
              id: (Date.now() + 2).toString(),
              role: "assistant",
              content: codeData.message || "App updated successfully! The changes should be visible in the preview.",
              timestamp: new Date(),
            });
            
            return newMessages;
          });
        } else {
          setMessages((prev) => {
            const filtered = prev.filter((msg) => msg.id !== thinkingMessageId);
            return [
              ...filtered,
              {
                id: (Date.now() + 2).toString(),
                role: "assistant",
                content: `Failed to update app: ${codeData.error || "Unknown error"}`,
                timestamp: new Date(),
              },
            ];
          });
        }
      } catch (error) {
        setMessages((prev) => {
          const filtered = prev.filter((msg) => msg.id !== thinkingMessageId);
          return [
            ...filtered,
            {
              id: (Date.now() + 2).toString(),
              role: "assistant",
              content: `Error updating app: ${error instanceof Error ? error.message : "Unknown error"}`,
              timestamp: new Date(),
            },
          ];
        });
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
    <div className="flex flex-col h-full bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Chat</CardTitle>
            <CardDescription>
              Describe your app in natural language
            </CardDescription>
          </div>
          {sandboxId && (
            <Button
              variant="outline"
              size="sm"
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
            >
              {viewingLogs ? "Loading..." : "View Logs"}
            </Button>
          )}
        </div>
      </CardHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {logs && logs.success && (
          <div className="mb-4 p-3 bg-muted rounded-lg text-xs font-mono overflow-auto max-h-60">
            <div className="font-bold mb-2">Sandbox Logs:</div>
            {logs.logs.expoLogs && (
              <div className="mb-2">
                <div className="font-semibold">Expo Logs:</div>
                <pre className="whitespace-pre-wrap">{logs.logs.expoLogs}</pre>
              </div>
            )}
            {logs.logs.processCheck && (
              <div className="mb-2">
                <div className="font-semibold">Running Processes:</div>
                <pre className="whitespace-pre-wrap">{logs.logs.processCheck}</pre>
              </div>
            )}
            {logs.logs.portCheck && (
              <div className="mb-2">
                <div className="font-semibold">Port Status:</div>
                <pre className="whitespace-pre-wrap">{logs.logs.portCheck}</pre>
              </div>
            )}
            {logs.logs.appDirCheck && (
              <div className="mb-2">
                <div className="font-semibold">App Directory:</div>
                <pre className="whitespace-pre-wrap">{logs.logs.appDirCheck}</pre>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs(null)}
              className="mt-2"
            >
              Close
            </Button>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button onClick={handleSend} size="icon" disabled={isLoading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
