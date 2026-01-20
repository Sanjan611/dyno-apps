import { Sandbox } from "modal";
import { createModalClient } from "@/lib/server/modal";
import { getProject } from "@/lib/server/projectStore";
import {
  withAsyncParams,
  successResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/server/api-utils";
import { REPO_DIR, LOG_PREFIXES } from "@/lib/constants";
import type { FileNode } from "@/types/api";

/**
 * Directories and files to exclude from the file tree
 */
const EXCLUDED = new Set([
  'node_modules',
  '.git',
  '.expo',
  '.next',
  'dist',
  'build',
  '.cache',
  '.DS_Store',
  'Thumbs.db',
  '.turbo',
  'coverage',
  '.bun',
]);

/**
 * Recursively builds a file tree from a directory in the sandbox
 */
async function buildFileTree(
  sandbox: Sandbox,
  dirPath: string
): Promise<FileNode[]> {
  const lsProcess = await sandbox.exec(["ls", "-1", "-p", dirPath], { workdir: REPO_DIR });
  const output = await lsProcess.stdout.readText();
  await lsProcess.wait();

  const lines = output.split("\n").filter((line: string) => line.trim());
  const nodes: FileNode[] = [];

  for (const line of lines) {
    const name = line.trim();
    if (!name || EXCLUDED.has(name.replace('/', ''))) continue;

    const isDir = name.endsWith("/");
    const cleanName = isDir ? name.slice(0, -1) : name;
    const fullPath = `${dirPath}/${cleanName}`;

    const node: FileNode = {
      name: cleanName,
      path: fullPath,
      type: isDir ? 'directory' : 'file',
    };

    if (isDir) {
      node.children = await buildFileTree(sandbox, fullPath);
    }

    nodes.push(node);
  }

  // Sort: directories first, then alphabetical
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * GET /api/projects/[id]/files - List all files in the project
 */
export const GET = withAsyncParams(async (request, user, params) => {
  try {
    const projectId = params.id;
    console.log(`${LOG_PREFIXES.PROJECTS} List files request for project:`, projectId);

    const project = await getProject(projectId, user.id);

    if (!project) {
      return notFoundResponse("Project not found");
    }

    if (!project.currentSandboxId) {
      return notFoundResponse("Sandbox not found for this project");
    }

    const modal = createModalClient();
    const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);

    const tree = await buildFileTree(sandbox, REPO_DIR);

    console.log(`${LOG_PREFIXES.PROJECTS} File tree built with ${tree.length} root items`);

    return successResponse({ tree });
  } catch (error) {
    console.error(`${LOG_PREFIXES.PROJECTS} Error listing files:`, error);
    return internalErrorResponse(error);
  }
});
