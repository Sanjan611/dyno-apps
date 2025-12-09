"use client";

import { Send, Square, MessageCircle, Hammer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { MessageMode } from "@/types";

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
      <div className="relative flex items-center">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !isLoading && !disabled && onSend()}
          placeholder={disabled ? "Start sandbox to begin..." : (currentMode === 'ask' ? "Ask a question..." : "Type your message...")}
          className="pr-12 py-6 rounded-full border-slate-200 bg-slate-50 focus:bg-white focus:border-primary/30 focus:ring-primary/20 shadow-inner"
          disabled={isLoading || disabled}
        />
        <Button
          onClick={handleButtonClick}
          size="icon"
          disabled={disabled || (!isLoading && !input.trim())}
          className={`absolute right-1.5 h-9 w-9 rounded-full transition-all shadow-sm ${
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

