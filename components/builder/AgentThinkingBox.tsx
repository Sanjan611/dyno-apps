"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentAction, AgentActionType } from "@/types";

// Re-export for backwards compatibility
export type { AgentAction, AgentActionType };

interface AgentThinkingBoxProps {
  actions: AgentAction[];
  isComplete: boolean;
}

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
  const [isCollapsed, setIsCollapsed] = useState(isComplete);

  // Auto-scroll to bottom when new actions are added
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actions, isCollapsed]);

  if (actions.length === 0 && !isComplete) {
    return null;
  }

  // Check if any action is still in progress
  const hasInProgressAction = actions.some(action => action.status === 'in_progress');
  const isWorking = !isComplete && hasInProgressAction;

  return (
    <div className="border rounded-lg bg-muted/30 overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50 flex items-center justify-between transition-colors"
      >
        <span className={cn(isWorking && "animate-pulse")}>
          {isWorking ? "Agent working" : "Agent complete"}
        </span>
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
                    <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                  )}
                </div>
                <span className="text-muted-foreground flex-1">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
