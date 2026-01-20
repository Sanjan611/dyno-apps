"use client";

import { useState, useEffect, useCallback } from "react";
import { useBuilderStore } from "@/lib/store";
import { API_ENDPOINTS } from "@/lib/constants";
import FileTree from "./code-viewer/FileTree";
import CodeEditor from "./code-viewer/CodeEditor";
import UnsavedChangesModal from "./UnsavedChangesModal";
import { Save, X, FileCode2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CodeViewer() {
  const {
    projectId,
    sandboxStarted,
    setCodeViewerDirty,
    // Code viewer cached state from store
    codeViewerFileTree: fileTree,
    codeViewerSelectedPath: selectedPath,
    codeViewerFileContent: fileContent,
    codeViewerOriginalContent: originalContent,
    codeViewerFileLanguage: fileLanguage,
    codeViewerFileCache: fileCache,
    setCodeViewerFileTree,
    setCodeViewerSelectedFile,
    cacheCodeViewerFile,
  } = useBuilderStore();

  // Transient UI state (not persisted between tab switches)
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Edit state
  const [modifiedPaths, setModifiedPaths] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Modal state
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // Local state for current edits (tracks unsaved changes)
  const [localFileContent, setLocalFileContent] = useState<string>(fileContent);

  // Sync local content with store when selected file changes
  useEffect(() => {
    setLocalFileContent(fileContent);
  }, [fileContent]);

  const isDirty = localFileContent !== originalContent;

  // Sync dirty state to store
  useEffect(() => {
    setCodeViewerDirty(isDirty);
  }, [isDirty, setCodeViewerDirty]);

  // Fetch file tree (only if not cached in store)
  const fetchTree = useCallback(async (forceRefresh = false) => {
    if (!projectId) return;

    // Skip fetch if tree is already cached (unless force refresh)
    if (fileTree && !forceRefresh) {
      return;
    }

    setIsLoadingTree(true);
    setTreeError(null);

    try {
      const res = await fetch(API_ENDPOINTS.PROJECT_FILES(projectId));
      const data = await res.json();
      if (data.success) {
        setCodeViewerFileTree(data.tree);
      } else {
        setTreeError(data.error || "Failed to load files");
      }
    } catch (err) {
      console.error("Failed to load file tree:", err);
      setTreeError("Failed to load files");
    } finally {
      setIsLoadingTree(false);
    }
  }, [projectId, fileTree, setCodeViewerFileTree]);

  // Fetch on mount when sandbox is ready
  useEffect(() => {
    if (sandboxStarted && projectId) {
      fetchTree();
    }
  }, [sandboxStarted, projectId, fetchTree]);

  // Fetch file content (uses cache if available)
  const fetchFile = async (path: string) => {
    if (!projectId) return;

    // Check if file is already in cache
    const cachedFile = fileCache[path];
    if (cachedFile) {
      setCodeViewerSelectedFile(
        path,
        cachedFile.content,
        cachedFile.content,
        cachedFile.language
      );
      setLocalFileContent(cachedFile.content);
      return;
    }

    setIsLoadingFile(true);

    try {
      // Remove /repo/ prefix for the API call
      const relativePath = path.replace(/^\/repo\//, "");
      const res = await fetch(API_ENDPOINTS.PROJECT_FILE(projectId, relativePath));
      const data = await res.json();

      if (data.success) {
        const language = data.language || "plaintext";
        // Cache the file content
        cacheCodeViewerFile(path, data.content, language);
        // Update selected file state
        setCodeViewerSelectedFile(
          path,
          data.content,
          data.content,
          language
        );
        setLocalFileContent(data.content);
      } else {
        console.error("Failed to load file:", data.error);
      }
    } catch (err) {
      console.error("Failed to load file:", err);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Handle file selection
  const handleSelectFile = (path: string) => {
    if (isDirty) {
      setPendingPath(path);
    } else {
      fetchFile(path);
    }
  };

  // Handle content change
  const handleContentChange = (value: string) => {
    setLocalFileContent(value);
    if (selectedPath && value !== originalContent) {
      setModifiedPaths(prev => new Set(prev).add(selectedPath));
    } else if (selectedPath && value === originalContent) {
      setModifiedPaths(prev => {
        const next = new Set(prev);
        next.delete(selectedPath);
        return next;
      });
    }
  };

  // Save file
  const saveFile = async () => {
    if (!projectId || !selectedPath) return;
    setIsSaving(true);

    try {
      const relativePath = selectedPath.replace(/^\/repo\//, "");
      const res = await fetch(API_ENDPOINTS.PROJECT_FILE(projectId, relativePath), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: localFileContent }),
      });

      const data = await res.json();
      if (data.success) {
        // Update cache with saved content
        cacheCodeViewerFile(selectedPath, localFileContent, fileLanguage);
        // Update store with new original content
        setCodeViewerSelectedFile(
          selectedPath,
          localFileContent,
          localFileContent,
          fileLanguage
        );
        setModifiedPaths(prev => {
          const next = new Set(prev);
          next.delete(selectedPath);
          return next;
        });
      } else {
        console.error("Failed to save file:", data.error);
      }
    } catch (err) {
      console.error("Failed to save file:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Discard changes
  const discardChanges = () => {
    setLocalFileContent(originalContent);
    if (selectedPath) {
      setModifiedPaths(prev => {
        const next = new Set(prev);
        next.delete(selectedPath);
        return next;
      });
    }
  };

  // Modal handlers
  const handleModalSave = async () => {
    await saveFile();
    if (pendingPath) {
      fetchFile(pendingPath);
      setPendingPath(null);
    }
  };

  const handleModalDiscard = () => {
    discardChanges();
    if (pendingPath) {
      fetchFile(pendingPath);
      setPendingPath(null);
    }
  };

  if (!sandboxStarted) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-950">
        <div className="text-center text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Waiting for sandbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-950">
      {/* Modal */}
      {pendingPath && (
        <UnsavedChangesModal
          onSave={handleModalSave}
          onDiscard={handleModalDiscard}
          onCancel={() => setPendingPath(null)}
          isSaving={isSaving}
        />
      )}

      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <FileTree
          tree={fileTree}
          isLoading={isLoadingTree}
          error={treeError}
          selectedPath={selectedPath}
          modifiedPaths={modifiedPaths}
          onSelect={handleSelectFile}
          onRefresh={() => fetchTree(true)}
        />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-400 min-w-0">
            <FileCode2 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {selectedPath ? selectedPath.replace(/^\/repo\//, "") : "Select a file"}
            </span>
            {isDirty && <span className="text-yellow-500 ml-1">*</span>}
          </div>

          {selectedPath && (
            <div className="flex items-center gap-2">
              {isDirty && (
                <Button variant="ghost" size="sm" onClick={discardChanges}>
                  <X className="w-4 h-4 mr-1" />
                  Discard
                </Button>
              )}
              <Button size="sm" onClick={saveFile} disabled={!isDirty || isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0">
          {isLoadingFile ? (
            <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : selectedPath ? (
            <CodeEditor
              content={localFileContent}
              language={fileLanguage}
              onChange={handleContentChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-gray-500">
              Select a file to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
