"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useBuilderStore } from "@/lib/store";
import { useCodeGeneration } from "@/hooks/useCodeGeneration";
import { useProjectSession } from "@/hooks/useProjectSession";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { Message } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";

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
  const { setSandboxId, setPreviewUrl, sandboxId, setProjectId, projectId } = useBuilderStore();
  const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { generateCode } = useCodeGeneration();
  const { initializeProject, initializeExpo } = useProjectSession({
    setProjectId,
    setSandboxId,
    setPreviewUrl,
    setMessages,
  });

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
          // Initialize project and sandbox
          const { projectId: currentProjectId, sandboxId: currentSandboxId } =
            await initializeProject(newMessage);

          // Initialize Expo
          await initializeExpo(currentSandboxId, currentProjectId);

          // Generate code
          await generateCode(newMessage.content, currentProjectId, setMessages);
        } catch (error) {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Subsequent messages: just call the coding agent
      // Read projectId from store at call time to avoid stale closure values
      const currentProjectId = useBuilderStore.getState().projectId;
      if (!currentProjectId) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Error: No project available. Please refresh the page and try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      setIsLoading(true);
      try {
        await generateCode(newMessage.content, currentProjectId, setMessages);
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
      initializeProject,
      initializeExpo,
      generateCode,
      setMessages,
    ]
  );

  const handleSend = async () => {
    if (!input.trim()) return;
    const message = input;
    setInput("");
    await sendMessage(message);
  };

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
          {sandboxId && projectId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                setViewingLogs(true);
                try {
                  const response = await fetch(
                    API_ENDPOINTS.PROJECT_SANDBOX_LOGS(projectId)
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

        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        onSend={handleSend}
        isLoading={isLoading}
      />
    </div>
  );
}
