"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Search, FileCode, CheckCircle2, ListTodo, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AgentAction {
  id: string;
  type: 'status' | 'list_files' | 'read_file' | 'write_file' | 'todo' | 'parallel_read';
  description: string;
  timestamp: Date;
  status: 'in_progress' | 'completed';
}

interface AgentThinkingBoxProps {
  actions: AgentAction[];
  isComplete: boolean;
}

const actionIcons = {
  status: Loader2,
  list_files: Search,
  read_file: FileText,
  write_file: FileCode,
  todo: ListTodo,
  parallel_read: Search,
};

const actionLabels = {
  status: (desc: string) => desc,
  list_files: () => "Exploring project structure...",
  read_file: (desc: string) => desc.includes("Reading") ? desc : `Reading ${desc}...`,
  write_file: (desc: string) => desc.includes("Writing") ? desc : `Writing ${desc}...`,
  parallel_read: (desc: string) => desc || "Reading multiple files...",
  todo: (desc: string) => desc.includes("Planning") ? desc : `Planning: ${desc}`,
};

export default function AgentThinkingBox({ actions, isComplete }: AgentThinkingBoxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-scroll to bottom when new actions are added
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actions, isCollapsed]);

  if (actions.length === 0 && !isComplete) {
    return null;
  }

  return (
    <div className="border rounded-lg bg-muted/30 overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50 flex items-center justify-between transition-colors"
      >
        <span>Agent Thinking</span>
        {isCollapsed ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronUp className="w-3 h-3" />
        )}
      </button>
      
      {!isCollapsed && (
        <div
          ref={scrollRef}
          className="max-h-48 overflow-y-auto p-2 space-y-1"
        >
          {actions.map((action) => {
            const Icon = actionIcons[action.type];
            const label = actionLabels[action.type](action.description);
            const isInProgress = action.status === 'in_progress';

            return (
              <div
                key={action.id}
                className={cn(
                  "flex items-start gap-2 text-xs font-mono px-2 py-1 rounded",
                  "transition-opacity",
                  isInProgress ? "opacity-100" : "opacity-70"
                )}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isInProgress ? (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  ) : (
                    <Icon className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <span className="text-muted-foreground flex-1">{label}</span>
                {isComplete && !isInProgress && (
                  <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                )}
              </div>
            );
          })}
          {isComplete && actions.length > 0 && (
            <div className="text-xs text-muted-foreground/70 px-2 py-1 font-mono italic">
              Thinking complete
            </div>
          )}
        </div>
      )}
    </div>
  );
}
