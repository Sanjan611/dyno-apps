"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Home, Save, Zap, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_PROJECT_NAME, API_ENDPOINTS } from "@/lib/constants";
import { useBuilderStore } from "@/lib/store";
import UserProfileDropdown from "./UserProfileDropdown";

interface ProjectHeaderProps {
  projectName: string;
  projectId: string | null;
  onProjectNameChange: (name: string) => void;
  onSaveSuccess?: () => void;
  getMessagesForSave?: () => Array<{
    id: string;
    role: string;
    content: string;
    timestamp: Date;
    mode?: string;
  }>;
}

/**
 * Component for the builder page header
 * Handles project name editing and navigation
 */
export default function ProjectHeader({
  projectName,
  projectId,
  onProjectNameChange,
  onSaveSuccess,
  getMessagesForSave,
}: ProjectHeaderProps) {
  const [editingName, setEditingName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { credits, refreshCredits } = useBuilderStore();

  // Fetch credits on mount
  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingName(e.target.value);
  };

  const handleNameBlur = async () => {
    const trimmedName = editingName.trim();
    const previousName = projectName;
    // If empty, treat as default project name
    const finalName = trimmedName === "" ? DEFAULT_PROJECT_NAME : trimmedName;
    
    if (finalName === previousName) {
      // Reset to empty if it's the default name, otherwise keep the value
      setEditingName(previousName === DEFAULT_PROJECT_NAME ? "" : previousName);
      return;
    }

    // Update local state immediately
    onProjectNameChange(finalName);

    // If projectId exists, save to backend
    if (projectId) {
      setIsSavingName(true);
      try {
        const response = await fetch(API_ENDPOINTS.PROJECTS, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            title: finalName,
            name: finalName,
          }),
        });

        const data = await response.json();
        if (!data.success) {
          console.error("Failed to update project name:", data.error);
          // Revert to previous name on error
          onProjectNameChange(previousName);
          setEditingName(previousName === DEFAULT_PROJECT_NAME ? "" : previousName);
        } else {
          // Update editingName to reflect the saved value (empty if DEFAULT_PROJECT_NAME)
          setEditingName(finalName === DEFAULT_PROJECT_NAME ? "" : finalName);
        }
      } catch (error) {
        console.error("Error updating project name:", error);
        // Revert to previous name on error
        onProjectNameChange(previousName);
        setEditingName(previousName === DEFAULT_PROJECT_NAME ? "" : previousName);
      } finally {
        setIsSavingName(false);
      }
    } else {
      // No projectId yet, just update the local editing state
      setEditingName(finalName === DEFAULT_PROJECT_NAME ? "" : finalName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      // Reset to empty if DEFAULT_PROJECT_NAME, otherwise use projectName
      setEditingName(projectName === DEFAULT_PROJECT_NAME ? "" : projectName);
      e.currentTarget.blur();
    }
  };

  // Initialize editingName when projectName changes
  useEffect(() => {
    // If projectName is DEFAULT_PROJECT_NAME, show empty string (placeholder will show)
    setEditingName(projectName === DEFAULT_PROJECT_NAME ? "" : projectName);
  }, [projectName]);

  const handleSave = async () => {
    if (!projectId) {
      console.error("Cannot save: No project ID available");
      return;
    }

    setIsSaving(true);
    try {
      // Get messages from chat panel if available
      const messages = getMessagesForSave?.() ?? [];

      const response = await fetch(API_ENDPOINTS.PROJECT_SAVE(projectId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      const data = await response.json();
      if (!data.success) {
        console.error("Failed to save changes:", data.error);
        // Could add toast notification here in the future
        alert(`Failed to save changes: ${data.error}`);
      } else {
        console.log("Changes saved successfully:", data.message);
        // Could add toast notification here in the future
        if (data.committed && data.pushed) {
          // Success - notify parent component
          onSaveSuccess?.();
        } else if (!data.committed) {
          // No changes to commit - this is fine, just inform user
          console.log("No changes to commit");
        }
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      alert(`Error saving changes: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header className="h-14 border-b bg-white/80 backdrop-blur-md grid grid-cols-3 items-center px-4 z-50">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="hover:bg-slate-100 text-muted-foreground">
          <Link href="/">
            <Home className="w-5 h-5" />
          </Link>
        </Button>

        <div className="h-6 w-[1px] bg-slate-200" />

        <div>
          <div className="flex items-center gap-2">
            <Input
              ref={nameInputRef}
              value={editingName}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="text-sm font-semibold h-8 px-2 border-transparent bg-transparent hover:bg-slate-100 focus:bg-white focus:border-primary/20 focus:ring-1 focus:ring-primary/20 w-[200px] sm:w-[300px] transition-all rounded-md"
              placeholder={DEFAULT_PROJECT_NAME}
              disabled={isSavingName}
            />
            {isSavingName && (
              <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
            )}
          </div>
        </div>
      </div>

      {/* Center section */}
      <div className="flex items-center justify-center gap-2">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" fill="white" />
        </div>
        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
          Dyno Apps
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 justify-end">
        {/* Credit Balance Display */}
        {!credits.isLoading && credits.balance !== null && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-md">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">{Math.max(credits.balance, 0).toFixed(1)}</span>
          </div>
        )}
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-white shadow-sm"
          onClick={handleSave}
          disabled={isSaving || !projectId}
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <UserProfileDropdown />
      </div>
    </header>
  );
}

