"use client";

import { Send, Square, MessageCircle, Hammer } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { MessageMode } from "@/types";
import { useRef, useEffect } from "react";

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
    <div className="p-4 border-t bg-white mt-auto relative z-10">
      {/* Mode Toggle */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          onClick={() => onModeChange('ask')}
          disabled={isLoading || disabled}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${currentMode === 'ask'
              ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
              : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
            }
            ${isLoading || disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Ask</span>
        </button>
        <button
          onClick={() => onModeChange('build')}
          disabled={isLoading || disabled}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${currentMode === 'build'
              ? 'bg-primary/10 text-primary border-2 border-primary/30'
              : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
            }
            ${isLoading || disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <Hammer className="w-4 h-4" />
          <span>Build</span>
        </button>
      </div>

      {/* Input Field */}
      <div className="flex items-end gap-2 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20 shadow-inner transition-all">
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
          placeholder={disabled ? "Start sandbox to begin..." : (currentMode === 'ask' ? "Ask a question..." : "Type your message...")}
          className="min-h-0 border-0 bg-transparent px-0 py-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none overflow-y-auto"
          disabled={isLoading || disabled}
          rows={1}
        />
        <Button
          onClick={handleButtonClick}
          size="icon"
          disabled={disabled || (!isLoading && !input.trim())}
          className={`h-9 w-9 rounded-full transition-all shadow-sm flex-shrink-0 ${
            isLoading
              ? "bg-black hover:bg-black/90"
              : "bg-primary hover:bg-primary/90"
          }`}
        >
          {isLoading ? <Square className="w-4 h-4 text-white" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-center text-muted-foreground mt-2">
        {currentMode === 'ask'
          ? "Ask mode: Discuss and plan features without making changes"
          : "Build mode: AI will implement your requests"
        }
      </div>
    </div>
  );
}

