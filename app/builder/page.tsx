"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ChatPanel from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, MoreVertical, Home, AlertCircle, FolderOpen, ChevronLeft, Code2 } from "lucide-react";
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

            // Check sandbox health and create if needed
            setIsValidatingSandbox(true);
            try {
              // First check health
              const healthResponse = await fetch(
                `/api/projects/${projectId}/sandbox/health`
              );
              const healthData = await healthResponse.json();

              if (healthData.success) {
                if (!healthData.exists || !healthData.healthy) {
                  // Sandbox doesn't exist or is unhealthy, create/get a new one
                  const sandboxResponse = await fetch(
                    `/api/projects/${projectId}/sandbox`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                    }
                  );
                  const sandboxData = await sandboxResponse.json();

                  if (sandboxData.success) {
                    setSandboxId(sandboxData.sandboxId);
                  } else {
                    setSandboxMissing(true);
                  }
                } else {
                  // Sandbox is healthy, use existing one
                  setSandboxId(projectSandboxId);
                }
              } else {
                // Health check failed, try to create sandbox
                const sandboxResponse = await fetch(
                  `/api/projects/${projectId}/sandbox`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                  }
                );
                const sandboxData = await sandboxResponse.json();

                if (sandboxData.success) {
                  setSandboxId(sandboxData.sandboxId);
                } else {
                  setSandboxMissing(true);
                }
              }
            } catch (error) {
              console.error("Error checking/creating sandbox:", error);
              // Try to create sandbox as fallback
              try {
                const sandboxResponse = await fetch(
                  `/api/projects/${projectId}/sandbox`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                  }
                );
                const sandboxData = await sandboxResponse.json();
                if (sandboxData.success) {
                  setSandboxId(sandboxData.sandboxId);
                } else {
                  setSandboxMissing(true);
                }
              } catch (fallbackError) {
                setSandboxMissing(true);
              }
            } finally {
              setIsValidatingSandbox(false);
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
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b bg-white/80 backdrop-blur-md flex items-center justify-between px-4 z-50">
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
                placeholder="Untitled Project"
                disabled={isSavingName}
              />
              {isSavingName && (
                <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="hidden sm:flex gap-2 bg-white hover:bg-slate-50">
            <Link href="/project-gallery">
              <FolderOpen className="w-4 h-4" />
              My Projects
            </Link>
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white shadow-sm">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {sandboxMissing ? (
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
          <Card className="max-w-md w-full border-destructive/20 shadow-lg animate-in fade-in zoom-in-95">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-destructive/10">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <CardTitle>Sandbox Not Found</CardTitle>
              </div>
              <CardDescription className="mt-2">
                The sandbox for this project no longer exists. You can go back to the gallery or
                start a new project.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex gap-3 justify-end">
              <Button variant="outline" asChild>
                <Link href="/project-gallery">Back to Gallery</Link>
              </Button>
              <Button asChild className="bg-primary">
                <Link href="/builder">Start New Project</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : isValidatingSandbox ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Setting up your environment...</p>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
          {/* Left Panel (Chat) */}
          <div className="h-full overflow-hidden bg-white z-10 shadow-xl shadow-slate-200/50" style={{ width: `${leftWidth}%` }}>
            <ChatPanel initialPrompt={initialPrompt} />
          </div>

          {/* Resizer */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 bottom-0 w-1.5 cursor-col-resize group z-20 hover:bg-primary/20 transition-colors"
            style={{ left: `${leftWidth}%`, transform: "translateX(-50%)" }}
          >
            <div
              className={`w-px h-full bg-slate-200 group-hover:bg-primary transition-colors mx-auto ${
                isDragging ? "bg-primary w-0.5" : ""
              }`}
            />
          </div>

          {/* Right Panel (Preview/Code) */}
          <div className="h-full overflow-hidden bg-slate-100/50 backdrop-blur-sm" style={{ width: `${100 - leftWidth}%` }}>
            <PreviewPanel />
          </div>
        </div>
      )}
    </div>
  );
}
