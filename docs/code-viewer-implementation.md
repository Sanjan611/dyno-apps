# Code Viewer Feature Implementation Summary

## Problem Statement

The builder page had a "Code" tab that displayed "Coming soon!" placeholder text. The goal was to implement a full-featured code viewer/editor that allows users to:

1. Browse project files in the `/repo` directory (inside the Modal sandbox)
2. View and edit files with syntax highlighting using Monaco editor
3. Save changes back to the sandbox
4. Handle unsaved changes when switching tabs (require save/discard before leaving Code tab)
5. Exclude non-essential directories (`node_modules`, `.git`, `.expo`, etc.)

---

## Changes Made

### 1. API Endpoints

#### `app/api/projects/[id]/files/route.ts` (NEW)
- **GET** - Lists all files recursively in `/repo` directory
- Returns tree structure with `FileNode[]`
- Excludes: `node_modules`, `.git`, `.expo`, `.next`, `dist`, `build`, `.cache`, `.DS_Store`, `.turbo`, `coverage`, `.bun`

#### `app/api/projects/[id]/files/[...path]/route.ts` (NEW)
- **GET** - Reads file content with language detection (30+ languages supported)
- **PUT** - Writes file content back to sandbox
- Path validation to prevent directory traversal attacks
- Content truncation at 50KB (`CONTENT_LIMITS.FILE_CONTENT_DISPLAY`)

---

### 2. Type Definitions

#### `types/api.ts` (MODIFIED)
Added:
```typescript
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface ListFilesResponse {
  success: boolean;
  tree?: FileNode[];
  error?: string;
}

export interface ReadFileResponse {
  success: boolean;
  path?: string;
  content?: string;
  language?: string;
  truncated?: boolean;
  error?: string;
}

export interface WriteFileResponse {
  success: boolean;
  path?: string;
  error?: string;
}
```

---

### 3. Constants

#### `lib/constants.ts` (MODIFIED)
Added API endpoint helpers:
```typescript
PROJECT_FILES: (id: string) => `/api/projects/${id}/files`,
PROJECT_FILE: (id: string, path: string) => `/api/projects/${id}/files/${path}`,
```

---

### 4. Store Updates

#### `lib/stores/builder-store.ts` (MODIFIED)
Added:
- `codeViewerDirty: boolean` - Tracks if code editor has unsaved changes
- `setCodeViewerDirty: (dirty: boolean) => void` - Setter function

---

### 5. UI Components

#### `components/builder/code-viewer/CodeEditor.tsx` (NEW)
- Monaco editor wrapper with VS Dark theme
- Options: no minimap, word wrap, line numbers, auto-layout

#### `components/builder/code-viewer/FileTreeNode.tsx` (NEW)
- Recursive component for file/directory nodes
- Expandable directories (auto-expand first 2 levels)
- Shows yellow dot indicator for modified files

#### `components/builder/code-viewer/FileTree.tsx` (NEW)
- Sidebar with "Files" header and refresh button
- Loading, error, and empty states

#### `components/builder/UnsavedChangesModal.tsx` (NEW)
- Modal with Save/Discard/Cancel buttons
- Used when user tries to switch tabs with unsaved changes

#### `components/builder/CodeViewer.tsx` (REWRITTEN)
- Full implementation replacing "Coming soon!" placeholder
- File tree sidebar (256px width)
- Toolbar showing current file path with dirty indicator
- Save/Discard buttons
- Monaco editor for selected file
- Handles file selection with unsaved changes check

#### `components/builder/PreviewPanel.tsx` (MODIFIED)
- Tab click handlers now check `codeViewerDirty` before switching
- Shows `UnsavedChangesModal` when leaving Code tab with unsaved changes

---

### 6. Dependencies

Added:
```bash
pnpm add @monaco-editor/react
```

---

## File Structure

```
app/api/projects/[id]/files/
├── route.ts                    # GET /files - list files
└── [...path]/
    └── route.ts                # GET/PUT /files/{path} - read/write file

components/builder/
├── code-viewer/
│   ├── CodeEditor.tsx          # Monaco editor wrapper
│   ├── FileTree.tsx            # File tree sidebar
│   └── FileTreeNode.tsx        # Tree node component
├── CodeViewer.tsx              # Main code viewer (rewritten)
├── PreviewPanel.tsx            # Tab container (modified)
└── UnsavedChangesModal.tsx     # Unsaved changes dialog (new)
```

---

## Known Integration Points

- Uses `useBuilderStore` for `projectId`, `sandboxStarted`, `codeViewerDirty`
- API calls require authenticated user (uses `withAsyncParams` wrapper)
- Sandbox must be started before file tree loads
- Files are read/written directly to Modal sandbox via `sandbox.open()` and `sandbox.exec()`

---

## Build Status

- Lint: Passes
- TypeScript: Passes
- Build: Successful
