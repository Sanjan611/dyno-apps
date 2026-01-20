"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import ChatPanel, { ChatPanelRef } from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";
import ProjectHeader from "@/components/builder/ProjectHeader";
import NavigationWarningModal from "@/components/builder/NavigationWarningModal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useBuilderStore } from "@/lib/store";
import { PANEL_CONSTRAINTS, API_ENDPOINTS, DEFAULT_PROJECT_NAME } from "@/lib/constants";
import type { Message } from "@/types";

// Loading fallback
function BuilderLoading() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <p className="text-muted-foreground font-medium">Loading builder...</p>
    </div>
  );
}

// Project not found component
function ProjectNotFound() {
  return (
    <div className="h-screen flex items-center justify-center p-8 bg-slate-50/50">
      <Card className="max-w-md w-full border-destructive/20 shadow-lg animate-in fade-in zoom-in-95">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Project Not Found</CardTitle>
          </div>
          <CardDescription className="mt-2">
            The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it. Please go back to the gallery to create a new project or open an existing one.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-3 justify-end">
          <Button variant="outline" asChild>
            <Link href="/project-gallery">Back to Gallery</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function BuilderPage() {
  const params = useParams();
  const projectIdFromRoute = params.projectId as string;
  
  const [leftWidth, setLeftWidth] = useState(PANEL_CONSTRAINTS.DEFAULT_LEFT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [initialMessages, setInitialMessages] = useState<Message[] | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);
  const router = useRouter();
  const pathname = usePathname();
  
  const {
    projectName,
    setProjectName,
    setProjectId,
    setSandboxId,
    setPreviewUrl,
    projectId,
    sandboxStarted,
    setSandboxStarted,
    setSandboxHealthStatus,
  } = useBuilderStore();

  // On mount: Load project from route param and initialize store
  useEffect(() => {
    const loadProject = async () => {
      if (!projectIdFromRoute) {
        setProjectNotFound(true);
        setIsLoading(false);
        return;
      }

      try {
        // Clear any stale project-scoped state from previous project
        setSandboxId(null);
        setPreviewUrl(null);
        setSandboxStarted(false);
        setSandboxHealthStatus("unknown");
        setInitialMessages(undefined);

        // Fetch project details
        const response = await fetch(`${API_ENDPOINTS.PROJECTS}?projectId=${projectIdFromRoute}`);
        const data = await response.json();

        if (data.success && data.project) {
          setProjectId(data.project.id);
          const projectTitle = data.project.title ?? data.project.name ?? DEFAULT_PROJECT_NAME;
          setProjectName(projectTitle);

          // Fetch conversation history
          try {
            const historyRes = await fetch(API_ENDPOINTS.PROJECT_HISTORY(data.project.id));
            const historyData = await historyRes.json();
            if (historyData.success && historyData.messages?.length > 0) {
              setInitialMessages(historyData.messages);
            }
          } catch (historyError) {
            console.error("Error loading conversation history:", historyError);
            // Continue without history - not a fatal error
          }

          setIsLoading(false);
        } else {
          // Project not found or error
          setProjectNotFound(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading project:", error);
        setProjectNotFound(true);
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectIdFromRoute, setProjectId, setProjectName, setSandboxId, setPreviewUrl, setSandboxStarted, setSandboxHealthStatus]);

  // Intercept navigation when sandbox is started
  useEffect(() => {
    if (!sandboxStarted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Navigating away will close the sandbox. Please save your work before exiting.";
      return e.returnValue;
    };

    // Intercept browser navigation (tab close, refresh)
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Intercept Next.js Link navigation
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      
      if (link && link.href) {
        try {
          const url = new URL(link.href);
          const currentUrl = new URL(window.location.href);
          
          // Only intercept if navigating to a different route (same origin)
          if (url.origin === currentUrl.origin && url.pathname !== pathname) {
            e.preventDefault();
            e.stopPropagation();
            setPendingNavigation(() => () => {
              router.push(url.pathname + url.search);
            });
            setShowNavigationWarning(true);
          }
        } catch (error) {
          // Invalid URL, ignore
          console.warn("Invalid URL in link click:", link.href);
        }
      }
    };

    document.addEventListener("click", handleLinkClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [sandboxStarted, pathname, router]);

  const handleStay = () => {
    setShowNavigationWarning(false);
    setPendingNavigation(null);
  };

  const handleLeave = async () => {
    setShowNavigationWarning(false);
    
    // Terminate sandbox
    if (projectId) {
      try {
        await fetch(API_ENDPOINTS.PROJECT_SANDBOX(projectId), {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Error terminating sandbox:", error);
      }
    }
    
    // Reset sandbox state
    setSandboxStarted(false);
    
    // Execute pending navigation
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleSaveSuccess = () => {
    chatPanelRef.current?.addSaveMarker();
  };

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

  // Show loading state
  if (isLoading) {
    return <BuilderLoading />;
  }

  // Show not found state
  if (projectNotFound) {
    return <ProjectNotFound />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Navigation Warning Modal */}
      {showNavigationWarning && (
        <NavigationWarningModal onStay={handleStay} onLeave={handleLeave} />
      )}

      {/* Header */}
      <ProjectHeader
        projectName={projectName}
        projectId={projectId}
        onProjectNameChange={setProjectName}
        onSaveSuccess={handleSaveSuccess}
        getMessagesForSave={() => chatPanelRef.current?.getMessages() ?? []}
      />

      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* Left Panel (Chat) */}
        <div className="h-full overflow-hidden bg-white z-10 shadow-xl shadow-slate-200/50" style={{ width: `${leftWidth}%` }}>
          <ChatPanel ref={chatPanelRef} initialMessages={initialMessages} />
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
    </div>
  );
}

