"use client";

import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import FileTreeNode from "./FileTreeNode";
import type { FileNode } from "@/types/api";

interface FileTreeProps {
  tree: FileNode[] | null;
  isLoading: boolean;
  error: string | null;
  selectedPath: string | null;
  modifiedPaths: Set<string>;
  onSelect: (path: string) => void;
  onRefresh: () => void;
}

export default function FileTree({
  tree,
  isLoading,
  error,
  selectedPath,
  modifiedPaths,
  onSelect,
  onRefresh,
}: FileTreeProps) {
  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Files</span>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          title="Refresh file tree"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-gray-500", isLoading && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {isLoading && !tree && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm text-gray-400">{error}</span>
          </div>
        )}

        {!isLoading && !error && tree && tree.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-gray-500">No files found</span>
          </div>
        )}

        {tree?.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            modifiedPaths={modifiedPaths}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
