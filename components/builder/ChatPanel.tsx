"use client";

import { useState } from "react";
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ChatPanel() {
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
  const { setSandboxId, setPreviewUrl, sandboxId } = useBuilderStore();

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInput("");

    // Check if this is the first user message
    const isFirstMessage = messages.length === 1 && messages[0].role === "assistant";

    if (isFirstMessage) {
      setIsLoading(true);
      try {
        const response = await fetch("/api/create-sandbox", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (data.success) {
          setSandboxId(data.sandboxId);
          const sandboxMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Sandbox created successfully! Initializing Expo application...`,
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
              body: JSON.stringify({ sandboxId: data.sandboxId }),
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
                    sandboxId: data.sandboxId,
                  }),
                });

                const codeData = await codeResponse.json();

                if (codeData.success) {
                  const successMessage: Message = {
                    id: (Date.now() + 3).toString(),
                    role: "assistant",
                    content: `App code generated successfully! Your app is now ready. Check the preview panel to see it.`,
                    timestamp: new Date(),
                  };
                  setMessages((prev) => [...prev, successMessage]);
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
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Failed to create sandbox: ${data.error || "Unknown error"}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } catch (error) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error creating sandbox: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    } else {
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
          // Remove the "thinking" message and add success message
          setMessages((prev) => {
            const filtered = prev.filter((msg) => msg.id !== thinkingMessageId);
            return [
              ...filtered,
              {
                id: (Date.now() + 2).toString(),
                role: "assistant",
                content: "App updated successfully! The changes should be visible in the preview.",
                timestamp: new Date(),
              },
            ];
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
    }
  };

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
