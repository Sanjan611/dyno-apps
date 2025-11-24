"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import ChatPanel from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";

export default function BuilderPage() {
  const [leftWidth, setLeftWidth] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain between 20% and 80% to prevent panels from becoming too small
      const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
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
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </Link>
          <h1 className="text-xl font-bold">Dyno Apps Builder</h1>
          <span className="text-sm text-muted-foreground">Untitled Project</span>
        </div>
      </header>

      {/* Split Panel Layout */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* Left Panel - Chat */}
        <div
          className="border-r flex flex-col"
          style={{ width: `${leftWidth}%` }}
        >
          <ChatPanel />
        </div>

        {/* Resizable Divider */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 bottom-0 w-1 bg-border hover:bg-primary cursor-col-resize transition-colors z-10 ${
            isDragging ? "bg-primary" : ""
          }`}
          style={{ left: `${leftWidth}%`, transform: "translateX(-50%)" }}
        >
          <div className="absolute inset-y-0 left-1/2 w-4 -translate-x-1/2" />
        </div>

        {/* Right Panel - Preview/Code */}
        <div
          className="flex flex-col"
          style={{ width: `${100 - leftWidth}%` }}
        >
          <PreviewPanel />
        </div>
      </div>
    </div>
  );
}
