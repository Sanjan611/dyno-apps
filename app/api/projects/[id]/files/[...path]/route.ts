import { NextRequest, NextResponse } from "next/server";
import { createModalClient } from "@/lib/server/modal";
import { getProject } from "@/lib/server/projectStore";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { REPO_DIR, CONTENT_LIMITS, LOG_PREFIXES } from "@/lib/constants";

/**
 * Map file extensions to Monaco editor language identifiers
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sh': 'shell',
  '.bash': 'shell',
  '.xml': 'xml',
  '.svg': 'xml',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.sql': 'sql',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.php': 'php',
};

/**
 * Get Monaco editor language from file path
 */
function getLanguage(filePath: string): string {
  const lastDotIndex = filePath.lastIndexOf('.');
  if (lastDotIndex === -1) return 'plaintext';
  const ext = filePath.substring(lastDotIndex).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || 'plaintext';
}

/**
 * Validate that a file path is safe and within REPO_DIR
 */
function isPathSafe(filePath: string): boolean {
  // Prevent directory traversal
  const normalized = filePath.replace(/\/+/g, '/');
  return normalized.startsWith(REPO_DIR) && !normalized.includes('..');
}

/**
 * GET /api/projects/[id]/files/[...path] - Read a file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, path: pathSegments } = await params;
    const filePath = `${REPO_DIR}/${pathSegments.join('/')}`;

    console.log(`${LOG_PREFIXES.PROJECTS} Read file request:`, filePath);

    if (!isPathSafe(filePath)) {
      return NextResponse.json({ success: false, error: "Invalid file path" }, { status: 400 });
    }

    const project = await getProject(projectId, user.id);
    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    if (!project.currentSandboxId) {
      return NextResponse.json({ success: false, error: "Sandbox not found" }, { status: 404 });
    }

    const modal = createModalClient();
    const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);

    try {
      const file = await sandbox.open(filePath, "r");
      const bytes = await file.read();
      await file.close();

      let content = new TextDecoder().decode(bytes);
      const truncated = content.length > CONTENT_LIMITS.FILE_CONTENT_DISPLAY;
      if (truncated) {
        content = content.substring(0, CONTENT_LIMITS.FILE_CONTENT_DISPLAY);
      }

      return NextResponse.json({
        success: true,
        path: filePath,
        content,
        language: getLanguage(filePath),
        truncated,
      });
    } catch (error) {
      console.error(`${LOG_PREFIXES.PROJECTS} Error reading file:`, filePath, error);
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }
  } catch (error) {
    console.error(`${LOG_PREFIXES.PROJECTS} Error in file read:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]/files/[...path] - Write a file
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, path: pathSegments } = await params;
    const filePath = `${REPO_DIR}/${pathSegments.join('/')}`;

    console.log(`${LOG_PREFIXES.PROJECTS} Write file request:`, filePath);

    if (!isPathSafe(filePath)) {
      return NextResponse.json({ success: false, error: "Invalid file path" }, { status: 400 });
    }

    let body: { content?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { content } = body;
    if (typeof content !== 'string') {
      return NextResponse.json({ success: false, error: "Content is required" }, { status: 400 });
    }

    const project = await getProject(projectId, user.id);
    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    if (!project.currentSandboxId) {
      return NextResponse.json({ success: false, error: "Sandbox not found" }, { status: 404 });
    }

    const modal = createModalClient();
    const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);

    try {
      const file = await sandbox.open(filePath, "w");
      await file.write(new TextEncoder().encode(content));
      await file.close();

      console.log(`${LOG_PREFIXES.PROJECTS} File written successfully:`, filePath);

      return NextResponse.json({
        success: true,
        path: filePath,
      });
    } catch (error) {
      console.error(`${LOG_PREFIXES.PROJECTS} Error writing file:`, filePath, error);
      return NextResponse.json(
        { success: false, error: "Failed to write file" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`${LOG_PREFIXES.PROJECTS} Error in file write:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
