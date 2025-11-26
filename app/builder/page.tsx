"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ChatPanel from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, MoreVertical, Home, AlertCircle, FolderOpen } from "lucide-react";
import { useBuilderStore } from "@/lib/store";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function BuilderPage() {
  const [leftWidth, setLeftWidth] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const [sandboxMissing, setSandboxMissing] = useState(false);
  const [isValidatingSandbox, setIsValidatingSandbox] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const { projectName, setProjectName, setProjectId, setSandboxId, projectId } = useBuilderStore();
  const initialPrompt = searchParams.get("prompt") ?? "";

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingName(e.target.value);
  };

  const handleNameBlur = async () => {
    const trimmedName = editingName.trim();
    const previousName = projectName;
    // If empty, treat as "Untitled Project"
    const finalName = trimmedName === "" ? "Untitled Project" : trimmedName;
    
    if (finalName === previousName) {
      // Reset to empty if it's "Untitled Project", otherwise keep the value
      setEditingName(previousName === "Untitled Project" ? "" : previousName);
      return;
    }

    // Update local state immediately
    setProjectName(finalName);

    // If projectId exists, save to backend
    if (projectId) {
      setIsSavingName(true);
      try {
        const response = await fetch("/api/projects", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            name: finalName,
          }),
        });

        const data = await response.json();
        if (!data.success) {
          console.error("Failed to update project name:", data.error);
          // Revert to previous name on error
          setProjectName(previousName);
          setEditingName(previousName === "Untitled Project" ? "" : previousName);
        } else {
          // Update editingName to reflect the saved value (empty if "Untitled Project")
          setEditingName(finalName === "Untitled Project" ? "" : finalName);
        }
      } catch (error) {
        console.error("Error updating project name:", error);
        // Revert to previous name on error
        setProjectName(previousName);
        setEditingName(previousName === "Untitled Project" ? "" : previousName);
      } finally {
        setIsSavingName(false);
      }
    } else {
      // No projectId yet, just update the local editing state
      setEditingName(finalName === "Untitled Project" ? "" : finalName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      // Reset to empty if "Untitled Project", otherwise use projectName
      setEditingName(projectName === "Untitled Project" ? "" : projectName);
      e.currentTarget.blur();
    }
  };

  // Initialize editingName when projectName changes
  useEffect(() => {
    // If projectName is "Untitled Project", show empty string (placeholder will show)
    setEditingName(projectName === "Untitled Project" ? "" : projectName);
  }, [projectName]);

  // Load project from query parameters
  useEffect(() => {
    const projectId = searchParams.get("projectId");
    const sandboxIdParam = searchParams.get("sandboxId");

    if (projectId) {
      // Fetch project data
      const loadProject = async () => {
        try {
          const response = await fetch(`/api/projects?projectId=${projectId}`);
          const data = await response.json();

          if (data.success && data.project) {
            setProjectId(data.project.id);
            setProjectName(data.project.name);
            const projectSandboxId = data.project.sandboxId;
            setSandboxId(projectSandboxId);

            // Validate sandbox exists
            if (projectSandboxId) {
              setIsValidatingSandbox(true);
              try {
                const validateResponse = await fetch(
                  `/api/validate-sandbox?sandboxId=${projectSandboxId}`
                );
                const validateData = await validateResponse.json();

                if (validateData.success && !validateData.exists) {
                  setSandboxMissing(true);
                }
              } catch (error) {
                console.error("Error validating sandbox:", error);
                // Assume sandbox is missing if validation fails
                setSandboxMissing(true);
              } finally {
                setIsValidatingSandbox(false);
              }
            } else {
              // No sandboxId in project, treat as missing
              setSandboxMissing(true);
            }
          }
        } catch (error) {
          console.error("Error loading project:", error);
        }
      };

      loadProject();
    } else if (sandboxIdParam) {
      // Direct sandboxId provided
      setSandboxId(sandboxIdParam);
    }
  }, [searchParams, setProjectId, setProjectName, setSandboxId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const newLeftWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      const constrainedWidth = Math.max(25, Math.min(75, newLeftWidth));
      setLeftWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/">
              <Home className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold">Dyno Apps Builder</h1>
            <div className="flex items-center gap-2">
              <Input
                ref={nameInputRef}
                value={editingName}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                className="text-sm text-muted-foreground h-7 px-2 border-transparent bg-transparent hover:border-border focus-visible:border-border focus-visible:ring-1 focus-visible:ring-ring max-w-[300px]"
                placeholder="Untitled Project"
                disabled={isSavingName}
              />
              {isSavingName && (
                <span className="text-xs text-muted-foreground">Saving...</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/project-gallery">
              <FolderOpen className="w-4 h-4 mr-2" />
              My Projects
            </Link>
          </Button>
          <Button variant="outline">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {sandboxMissing ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <CardTitle>Sandbox Not Found</CardTitle>
              </div>
              <CardDescription>
                The sandbox for this project no longer exists. You can go back to the gallery or
                start a new project.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/project-gallery">Back to Gallery</Link>
              </Button>
              <Button asChild>
                <Link href="/builder">Start New Project</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : isValidatingSandbox ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Validating sandbox...</p>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
          <div className="border-r" style={{ width: `${leftWidth}%` }}>
            <ChatPanel initialPrompt={initialPrompt} />
          </div>

          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 bottom-0 w-2 cursor-col-resize group z-10"
            style={{ left: `${leftWidth}%`, transform: "translateX(-50%)" }}
          >
            <div
              className={`w-0.5 h-full bg-border group-hover:bg-primary transition-colors mx-auto ${
                isDragging ? "bg-primary" : ""
              }`}
            />
          </div>

          <div style={{ width: `${100 - leftWidth}%` }}>
            <PreviewPanel />
          </div>
        </div>
      )}
    </div>
  );
}
