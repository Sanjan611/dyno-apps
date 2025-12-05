"use client";

import { Send, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading: boolean;
}

/**
 * Component for the chat input field and send button
 */
export default function ChatInput({
  input,
  setInput,
  onSend,
  onStop,
  isLoading,
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
      <div className="relative flex items-center">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !isLoading && onSend()}
          placeholder="Type your message..."
          className="pr-12 py-6 rounded-full border-slate-200 bg-slate-50 focus:bg-white focus:border-primary/30 focus:ring-primary/20 shadow-inner"
          disabled={isLoading}
        />
        <Button 
          onClick={handleButtonClick} 
          size="icon" 
          disabled={!isLoading && !input.trim()}
          className={`absolute right-1.5 h-9 w-9 rounded-full transition-all shadow-sm ${
            isLoading 
              ? "bg-black hover:bg-black/90" 
              : "bg-primary hover:bg-primary/90"
          }`}
        >
          {isLoading ? <Square className="w-4 h-4 text-white" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      <div className="text-xs text-center text-muted-foreground mt-2">
        AI can make mistakes. Check the code.
      </div>
    </div>
  );
}

