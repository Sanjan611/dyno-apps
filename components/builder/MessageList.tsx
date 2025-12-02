"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import AgentThinkingBox from "./AgentThinkingBox";
import type { Message } from "@/types";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

/**
 * Component for rendering the list of chat messages
 * Handles user, assistant, and thinking message types
 */
export default function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <>
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
    </>
  );
}

