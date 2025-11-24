"use client";

import { useState } from "react";
import AppPreview from "./AppPreview";
import CodeViewer from "./CodeViewer";
import { useBuilderStore } from "@/lib/store";

export default function PreviewPanel() {
  const [activeView, setActiveView] = useState<"preview" | "code">("preview");
  const { previewUrl } = useBuilderStore();

  return (
    <div className="flex flex-col h-full">
      {/* Toggle Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">
          {activeView === "preview" ? "Preview" : "Code"}
        </h2>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setActiveView("preview")}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeView === "preview"
                ? "bg-background shadow-sm"
                : "hover:bg-background/50"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveView("code")}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeView === "code"
                ? "bg-background shadow-sm"
                : "hover:bg-background/50"
            }`}
          >
            Code
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeView === "preview" ? (
          <AppPreview previewUrl={previewUrl} />
        ) : (
          <CodeViewer />
        )}
      </div>
    </div>
  );
}
