"use client";

import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Terminal, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CardHeader,
  CardTitle,
  CardDescription,
  Card,
  CardContent,
} from "@/components/ui/card";
import { useBuilderStore } from "@/lib/store";
import { useCodeGeneration } from "@/hooks/useCodeGeneration";
import { useSandboxStartup } from "@/hooks/useSandboxStartup";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { Message } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";

export interface ChatPanelRef {
  addSaveMarker: () => void;
  getMessages: () => Message[];
}

interface ChatPanelProps {
  initialMessages?: Message[];
}

const ChatPanel = forwardRef<ChatPanelRef, ChatPanelProps>(function ChatPanel({ initialMessages }, ref) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      // Convert ISO timestamp strings to Date objects if needed
      return initialMessages.map((m) => ({
        ...m,
        timestamp: typeof m.timestamp === "string" ? new Date(m.timestamp) : m.timestamp,
      }));
    }
    // Default welcome message for new projects
    return [
      {
        id: "1",
        role: "assistant",
        content:
          "Hello! I'm your AI assistant. Describe the mobile app you'd like to build, and I'll help you create it.",
        timestamp: new Date(),
      },
    ];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [logs, setLogs] = useState<any>(null);
  const { 
    sandboxId, 
    projectId, 
    currentMode, 
    setCurrentMode,
    sandboxStarted,
  } = useBuilderStore();
  const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const { generateCode, cancelGeneration, isGenerating } = useCodeGeneration();
  const { startSandbox, isStarting: isStartingSandbox, error: sandboxError, progressMessages, currentProgress } = useSandboxStartup();

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    addSaveMarker: () => {
      const saveMarker: Message = {
        id: `save-${Date.now()}`,
        role: "system",
        content: "Project saved",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, saveMarker]);
    },
    getMessages: () => messages,
  }), [messages]);

  // Auto-trigger sandbox startup on mount when projectId is available
  const hasStartedRef = useRef(false);
  useEffect(() => {
    // Only start sandbox if projectId is set (from route) and sandbox not already started
    if (projectId && !sandboxStarted && !isStartingSandbox && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startSandbox().catch((error) => {
        console.error("Error auto-starting sandbox:", error);
        hasStartedRef.current = false; // Allow retry on error
      });
    }
  }, [projectId, sandboxStarted, isStartingSandbox, startSandbox]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (rawContent: string, mode: 'ask' | 'build') => {
      const content = rawContent.trim();
      if (!content) return;

      // Don't allow sending messages if sandbox isn't started or no project
      if (!sandboxStarted || !projectId) {
        return;
      }

      const newMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
        mode,
      };

      setMessages((prev) => [...prev, newMessage]);

      const isFirstMessage = !hasSentInitialMessage;
      if (isFirstMessage) {
        setHasSentInitialMessage(true);
      }

      // Read projectId from store at call time to ensure we have the latest value
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
        // Generate code (state is managed server-side)
        const { promise, abort } = generateCode(newMessage.content, currentProjectId, setMessages, mode);
        abortRef.current = abort;
        await promise;
      } catch (error) {
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [
      hasSentInitialMessage,
      generateCode,
      setMessages,
      sandboxStarted,
      projectId,
    ]
  );

  const handleSend = async () => {
    if (!input.trim()) return;
    const message = input;
    const mode = currentMode; // Capture mode at send time
    setInput("");
    await sendMessage(message, mode);
  };

  const handleStop = () => {
    // Handle SSE abort
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setIsLoading(false);
    }
    // Handle Trigger.dev cancellation
    if (isGenerating) {
      cancelGeneration();
    }
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

        <MessageList messages={messages} isLoading={isLoading || isGenerating} />
      </div>

      {/* Setting Up Environment Overlay */}
      {!sandboxStarted && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="max-w-md w-full mx-4 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">Setting Up Environment</CardTitle>
              <CardDescription>
                Preparing your development sandbox and initializing Expo. This may take a moment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sandboxError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{sandboxError}</p>
                </div>
              )}
              {(progressMessages.length > 0 || currentProgress || isStartingSandbox) && (
                <div className="space-y-2 pt-2">
                  {progressMessages.map((message, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-muted-foreground">{message}</span>
                    </div>
                  ))}
                  {(currentProgress || isStartingSandbox) && (
                    <div className="flex items-center gap-2 text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                      <span className="font-medium">{currentProgress || "Setting up..."}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ChatInput
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onStop={handleStop}
        isLoading={isLoading || isGenerating}
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        disabled={!sandboxStarted}
      />
    </div>
  );
});

export default ChatPanel;
