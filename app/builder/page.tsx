"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ChatPanel from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";
import { Button } from "@/components/ui/button";
import { Save, MoreVertical, Home } from "lucide-react";
import { useBuilderStore } from "@/lib/store";

export default function BuilderPage() {
  const [leftWidth, setLeftWidth] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const { projectName, setProjectName, setProjectId, setSandboxId } = useBuilderStore();
  const initialPrompt = searchParams.get("prompt") ?? "";

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  // Load project from query parameters
  useEffect(() => {
    const projectId = searchParams.get("projectId");
    const sandboxId = searchParams.get("sandboxId");

    if (projectId) {
      // Fetch project data
      const loadProject = async () => {
        try {
          const response = await fetch(`/api/projects?projectId=${projectId}`);
          const data = await response.json();

          if (data.success && data.project) {
            setProjectId(data.project.id);
            setProjectName(data.project.name);
            setSandboxId(data.project.sandboxId);
          }
        } catch (error) {
          console.error("Error loading project:", error);
        }
      };

      loadProject();
    } else if (sandboxId) {
      // Direct sandboxId provided
      setSandboxId(sandboxId);
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
            <p className="text-sm text-muted-foreground">{projectName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </header>

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
    </div>
  );
}
