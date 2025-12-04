"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ChatPanel from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";
import ProjectHeader from "@/components/builder/ProjectHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useBuilderStore } from "@/lib/store";
import { useProjectLoader } from "@/hooks/useProjectLoader";
import { PANEL_CONSTRAINTS } from "@/lib/constants";

// Loading fallback for Suspense boundary
function BuilderLoading() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <p className="text-muted-foreground font-medium">Loading builder...</p>
    </div>
  );
}

// Main builder content (uses useSearchParams)
function BuilderContent() {
  const [leftWidth, setLeftWidth] = useState(PANEL_CONSTRAINTS.DEFAULT_LEFT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const {
    projectName,
    setProjectName,
    setProjectId,
    setSandboxId,
    projectId,
    reset,
  } = useBuilderStore();
  const initialPrompt = searchParams.get("prompt") ?? "";

  const { sandboxMissing, isValidatingSandbox } = useProjectLoader({
    setProjectId,
    setProjectName,
    setSandboxId,
    reset,
  });

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const newLeftWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      const constrainedWidth = Math.max(PANEL_CONSTRAINTS.MIN_WIDTH, Math.min(PANEL_CONSTRAINTS.MAX_WIDTH, newLeftWidth));
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
      <ProjectHeader
        projectName={projectName}
        projectId={projectId}
        onProjectNameChange={setProjectName}
      />

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

// Wrapper component with Suspense boundary for useSearchParams
export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderLoading />}>
      <BuilderContent />
    </Suspense>
  );
}
