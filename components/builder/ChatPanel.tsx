"use client";

import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useBuilderStore } from "@/lib/store";
import { useCodeGeneration, InsufficientCreditsError } from "@/hooks/useCodeGeneration";
import { useSandboxStartup } from "@/hooks/useSandboxStartup";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { Message } from "@/types";

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
  const {
    projectId,
    currentMode,
    setCurrentMode,
    sandboxStarted,
    refreshCredits,
  } = useBuilderStore();
  const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const { generateCode, cancelGeneration, isGenerating } = useCodeGeneration();
  const { startSandbox, isStarting: isStartingSandbox } = useSandboxStartup();

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

      // Create thinking message immediately (optimistic UI)
      // This eliminates the loading dots phase and shows the thinking box right away
      const thinkingMessageId = (Date.now() + 1).toString();
      const thinkingMessage: Message = {
        id: thinkingMessageId,
        role: "assistant",
        variant: "thinking",
        content: "",
        timestamp: new Date(),
        actions: [{
          id: `${Date.now()}-initial`,
          type: 'status',
          description: 'Analyzing your request...',
          timestamp: new Date(),
          status: 'in_progress',
        }],
        isComplete: false,
      };
      setMessages((prev) => [...prev, thinkingMessage]);

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
        // Pass the thinking message ID so generateCode can use it instead of creating a new one
        const { promise, abort } = generateCode(newMessage.content, currentProjectId, setMessages, mode, undefined, thinkingMessageId);
        abortRef.current = abort;
        await promise;
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          // Remove the thinking message and show clean error for insufficient credits
          setMessages((prev) => {
            const withoutThinking = prev.filter((m) => m.id !== thinkingMessageId);
            return [
              ...withoutThinking,
              {
                id: (Date.now() + 2).toString(),
                role: "assistant",
                content: "You don't have enough credits to run the agent. Please add more credits to continue.",
                timestamp: new Date(),
              },
            ];
          });
        } else {
          const errorMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
        // Refresh credits after generation completes (credits were deducted server-side)
        refreshCredits();
      }
    },
    [
      hasSentInitialMessage,
      generateCode,
      setMessages,
      sandboxStarted,
      projectId,
      refreshCredits,
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
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 bg-grid-pattern"
      >
        <MessageList messages={messages} />
      </div>

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
