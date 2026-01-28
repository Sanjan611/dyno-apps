"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import AgentThinkingBox from "./AgentThinkingBox";
import type { Message } from "@/types";

interface MessageListProps {
  messages: Message[];
}

/**
 * Component for rendering the list of chat messages
 * Handles user, assistant, and thinking message types
 */
export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex flex-col gap-6 pb-4">
      {messages.map((message) => {
        if (message.role === "system") {
          return (
            <div key={message.id} className="flex items-center gap-4 py-2 animate-in fade-in relative z-10 opacity-70">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-50/50 px-2 py-1 rounded-full border border-slate-100">{message.content}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            </div>
          );
        }

        if (message.role === "thinking") {
          return (
            <div key={message.id} className="flex justify-start animate-in fade-in slide-in-from-left-2 relative z-10 pl-2 group pb-5">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-primary shadow-sm flex-shrink-0 mb-1 group-hover:scale-105 transition-transform mr-3">
                <Bot className="w-5 h-5" />
              </div>
              <div className="max-w-[85%] w-full space-y-3">
                <AgentThinkingBox
                  actions={message.actions || []}
                  isComplete={message.isComplete || false}
                />
                {message.replyContent && (
                  <div className="rounded-2xl px-5 py-3.5 text-sm shadow-sm max-w-[85%] bg-white border border-slate-100 text-slate-700 rounded-bl-sm hover:shadow-md">
                    <div className="prose prose-sm max-w-none break-words whitespace-pre-wrap leading-relaxed text-slate-700">
                      {message.replyContent}
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 left-12 text-[10px] text-slate-400">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        }

        const isUser = message.role === "user";

        return (
          <div
            key={message.id}
            className={cn(
              "flex items-end gap-3 animate-in fade-in slide-in-from-bottom-2 relative z-10 group pb-5",
              isUser ? "justify-end pr-2" : "justify-start pl-2"
            )}
          >
            {!isUser && (
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-primary shadow-sm flex-shrink-0 mb-1 group-hover:scale-105 transition-transform">
                <Bot className="w-5 h-5" />
              </div>
            )}

            <div
              className={cn(
                "rounded-2xl px-5 py-3.5 text-sm shadow-sm relative transition-all duration-200",
                isUser
                  ? "max-w-[85%] ml-12 bg-gradient-to-br from-primary to-secondary text-white rounded-br-sm shadow-primary/20 hover:shadow-primary/30 border border-white/10"
                  : "max-w-[70%] bg-white border border-slate-100 text-slate-700 rounded-bl-sm hover:shadow-md"
              )}
            >
              <div className={cn(
                "prose prose-sm max-w-none break-words whitespace-pre-wrap leading-relaxed",
                isUser ? "dark:prose-invert text-white/95 selection:bg-white/30 selection:text-white" : "text-slate-700"
              )}>
                {message.content}
              </div>
            </div>

            {isUser && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 shadow-sm flex-shrink-0 mb-1">
                <User className="w-4 h-4" />
              </div>
            )}

            <div className={cn(
              "absolute -bottom-1 text-[10px]",
              isUser ? "right-12 text-slate-400" : "left-12 text-slate-400"
            )}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
