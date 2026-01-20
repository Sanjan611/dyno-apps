"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/types/api";

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  modifiedPaths: Set<string>;
  onSelect: (path: string) => void;
}

export default function FileTreeNode({
  node,
  depth,
  selectedPath,
  modifiedPaths,
  onSelect,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = selectedPath === node.path;
  const isModified = modifiedPaths.has(node.path);

  if (node.type === 'directory') {
    return (
      <div>
        <button
          className={cn(
            "flex items-center gap-1 w-full px-2 py-1 text-sm hover:bg-gray-800 rounded",
            isSelected && "bg-gray-800"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          {expanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          )}
          <span className="text-gray-300 truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            modifiedPaths={modifiedPaths}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      className={cn(
        "flex items-center gap-1 w-full px-2 py-1 text-sm hover:bg-gray-800 rounded",
        isSelected && "bg-blue-900/50"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onSelect(node.path)}
    >
      <span className="w-4" /> {/* Spacer for alignment with directories */}
      <File className="w-4 h-4 text-gray-500 flex-shrink-0" />
      <span className="text-gray-300 truncate">{node.name}</span>
      {isModified && (
        <span className="w-2 h-2 rounded-full bg-yellow-500 ml-auto flex-shrink-0" />
      )}
    </button>
  );
}
