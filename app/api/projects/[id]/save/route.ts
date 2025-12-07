import { NextRequest } from "next/server";
import { createModalClient } from "@/lib/server/modal";
import { getProject } from "@/lib/server/projectStore";
import {
  withAsyncParams,
  successResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/server/api-utils";
import { REPO_DIR, TIMEOUTS, LOG_PREFIXES } from "@/lib/constants";

/**
 * POST /api/projects/[id]/save - Save changes to git repository
 * 
 * Stages all changes, commits with timestamp, and pushes to remote
 */
export const POST = withAsyncParams(async (request, user, params) => {
  try {
    if (!params || !params.id) {
      return notFoundResponse("Project ID is required");
    }
    const projectId = typeof params.id === 'string' ? params.id : await params.id;
    console.log(`${LOG_PREFIXES.PROJECTS} Save request for project:`, projectId, "user:", user.id);

    const project = await getProject(projectId, user.id);

    if (!project) {
      console.log(`${LOG_PREFIXES.PROJECTS} Project not found for save:`, projectId);
      return notFoundResponse("Project not found");
    }

    if (!project.currentSandboxId) {
      return notFoundResponse("Sandbox not found for this project");
    }

    const modal = createModalClient();
    const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);

    // Configure git user.name and user.email (local config in /repo)
    console.log(`${LOG_PREFIXES.PROJECTS} Configuring git user.name and user.email...`);
    try {
      const configNameProcess = await sandbox.exec(
        ["git", "config", "user.name", "Dyno Apps User"],
        { workdir: REPO_DIR }
      );
      const configNameExitCode = await configNameProcess.wait();
      if (configNameExitCode !== 0) {
        const stderr = await configNameProcess.stderr.readText().catch(() => "");
        console.warn(`${LOG_PREFIXES.PROJECTS} Warning: git config user.name failed:`, stderr);
      }

      const configEmailProcess = await sandbox.exec(
        ["git", "config", "user.email", "user@dyno-apps.com"],
        { workdir: REPO_DIR }
      );
      const configEmailExitCode = await configEmailProcess.wait();
      if (configEmailExitCode !== 0) {
        const stderr = await configEmailProcess.stderr.readText().catch(() => "");
        console.warn(`${LOG_PREFIXES.PROJECTS} Warning: git config user.email failed:`, stderr);
      }
    } catch (error) {
      console.error(`${LOG_PREFIXES.PROJECTS} Error configuring git:`, error);
      // Continue anyway - git commit will fail with a clear error if config is missing
    }

    // Stage all changes: git add .
    console.log(`${LOG_PREFIXES.PROJECTS} Staging changes (git add .)...`);
    const addProcess = await sandbox.exec(
      ["git", "add", "."],
      { workdir: REPO_DIR }
    );
    const addStdout = await addProcess.stdout.readText().catch(() => "");
    const addStderr = await addProcess.stderr.readText().catch(() => "");
    const addExitCode = await addProcess.wait();

    if (addExitCode !== 0) {
      const errorMsg = addStderr || addStdout || "Failed to stage changes";
      console.error(`${LOG_PREFIXES.PROJECTS} git add failed:`, errorMsg);
      return internalErrorResponse(new Error(`Failed to stage changes: ${errorMsg}`));
    }

    // Check if there are any changes to commit
    const statusProcess = await sandbox.exec(
      ["git", "status", "--porcelain"],
      { workdir: REPO_DIR }
    );
    const statusOutput = await statusProcess.stdout.readText().catch(() => "");
    await statusProcess.wait();

    // If no changes, return success (nothing to commit)
    if (!statusOutput.trim()) {
      console.log(`${LOG_PREFIXES.PROJECTS} No changes to commit`);
      return successResponse({
        message: "No changes to commit",
        committed: false,
        pushed: false,
      });
    }

    // Generate commit message with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const commitMessage = `Save changes - ${timestamp}`;

    // Commit changes: git commit -m "Save changes - {timestamp}"
    console.log(`${LOG_PREFIXES.PROJECTS} Committing changes:`, commitMessage);
    const commitProcess = await sandbox.exec(
      ["git", "commit", "-m", commitMessage],
      { workdir: REPO_DIR }
    );
    const commitStdout = await commitProcess.stdout.readText().catch(() => "");
    const commitStderr = await commitProcess.stderr.readText().catch(() => "");
    const commitExitCode = await commitProcess.wait();

    if (commitExitCode !== 0) {
      const errorMsg = commitStderr || commitStdout || "Failed to commit changes";
      console.error(`${LOG_PREFIXES.PROJECTS} git commit failed:`, errorMsg);
      
      // Check if it's a "nothing to commit" error (shouldn't happen after status check, but handle it)
      if (errorMsg.includes("nothing to commit") || errorMsg.includes("no changes")) {
        return successResponse({
          message: "No changes to commit",
          committed: false,
          pushed: false,
        });
      }
      
      return internalErrorResponse(new Error(`Failed to commit changes: ${errorMsg}`));
    }

    // Push changes: git push
    console.log(`${LOG_PREFIXES.PROJECTS} Pushing changes to remote...`);
    const pushProcess = await sandbox.exec(
      ["git", "push"],
      { workdir: REPO_DIR }
    );
    const pushStdout = await pushProcess.stdout.readText().catch(() => "");
    const pushStderr = await pushProcess.stderr.readText().catch(() => "");
    const pushExitCode = await pushProcess.wait();

    if (pushExitCode !== 0) {
      const errorMsg = pushStderr || pushStdout || "Failed to push changes";
      console.error(`${LOG_PREFIXES.PROJECTS} git push failed:`, errorMsg);
      
      // Check for authentication errors
      if (errorMsg.includes("authentication") || errorMsg.includes("unauthorized") || errorMsg.includes("403")) {
        return internalErrorResponse(new Error("Authentication failed. Please check GitHub credentials."));
      }
      
      // Check for network errors
      if (errorMsg.includes("network") || errorMsg.includes("timeout") || errorMsg.includes("connection")) {
        return internalErrorResponse(new Error("Network error while pushing. Please try again."));
      }
      
      return internalErrorResponse(new Error(`Failed to push changes: ${errorMsg}`));
    }

    console.log(`${LOG_PREFIXES.PROJECTS} Successfully saved and pushed changes for project:`, projectId);

    return successResponse({
      message: "Changes saved and pushed successfully",
      committed: true,
      pushed: true,
      commitMessage,
    });
  } catch (error) {
    console.error(`${LOG_PREFIXES.PROJECTS} Error saving project:`, error);
    return internalErrorResponse(error);
  }
});

