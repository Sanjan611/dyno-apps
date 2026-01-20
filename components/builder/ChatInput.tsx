"use client";

import { Send, Square, MessageCircle, Hammer } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { MessageMode } from "@/types";
import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading: boolean;
  currentMode: MessageMode;
  onModeChange: (mode: MessageMode) => void;
  disabled?: boolean;
}

/**
 * Component for the chat input field and send button with mode toggle
 */
export default function ChatInput({
  input,
  setInput,
  onSend,
  onStop,
  isLoading,
  currentMode,
  onModeChange,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to get accurate scrollHeight
      textarea.style.height = "auto";
      // Calculate single-line height based on line-height and padding
      // Line height is typically ~1.5em (24px for 16px base), plus padding (py-1 = 8px total)
      const singleLineHeight = 32;
      // Set new height based on content (min: single line, max: 200px)
      const newHeight = Math.max(singleLineHeight, Math.min(textarea.scrollHeight, 200));
      textarea.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleButtonClick = () => {
    if (isLoading && onStop) {
      onStop();
    } else {
      onSend();
    }
  };

  return (
    <div className="p-6 bg-transparent mt-auto relative z-10 w-full max-w-4xl mx-auto">
      <div className={cn(
        "rounded-3xl border shadow-xl transition-all duration-300 overflow-hidden",
        "bg-white/80 backdrop-blur-xl border-white/20",
        isLoading ? "ring-2 ring-primary/10" : "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30"
      )}>
        {/* Mode Toggle & Input Container */}
        <div className="flex flex-col gap-2 p-2">
          
          {/* Input Area */}
          <div className="flex items-end gap-2 pl-3 pr-2 py-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading && !disabled) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder={disabled ? "Start sandbox to begin..." : (currentMode === 'ask' ? "Ask a question..." : "Describe your app update...")}
              className="min-h-[40px] max-h-[200px] border-0 bg-transparent px-0 py-2.5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none overflow-y-auto text-base placeholder:text-muted-foreground/70"
              disabled={isLoading || disabled}
              rows={1}
            />
            
            <div className="flex items-center gap-2 pb-1.5">
               {/* Mode Switcher (Mini) */}
              <div className="flex bg-slate-100/80 rounded-lg p-0.5 border border-slate-200/50">
                <button
                  onClick={() => onModeChange('ask')}
                  disabled={isLoading || disabled}
                  title="Ask Mode"
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    currentMode === 'ask' 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                  )}
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onModeChange('build')}
                  disabled={isLoading || disabled}
                  title="Build Mode"
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    currentMode === 'build' 
                      ? "bg-white text-primary shadow-sm" 
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                  )}
                >
                  <Hammer className="w-4 h-4" />
                </button>
              </div>

              <Button
                onClick={handleButtonClick}
                size="icon"
                disabled={disabled || (!isLoading && !input.trim())}
                className={cn(
                  "h-9 w-9 rounded-full transition-all shadow-md flex-shrink-0",
                  isLoading
                    ? "bg-slate-900 hover:bg-slate-800"
                    : "bg-gradient-to-br from-primary to-secondary hover:opacity-90 hover:scale-105 hover:shadow-lg"
                )}
              >
                {isLoading ? <Square className="w-3.5 h-3.5 text-white fill-white" /> : <Send className="w-4 h-4 text-white ml-0.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer / Mode Indicator */}
      <div className="text-[10px] text-center text-muted-foreground/60 mt-2 font-medium tracking-wide uppercase">
        {currentMode === 'ask'
          ? "Ask Mode: Planning & Discussion"
          : "Build Mode: Code Generation Active"
        }
      </div>
    </div>
  );
}
