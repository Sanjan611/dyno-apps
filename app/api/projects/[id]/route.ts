import { NextRequest } from "next/server";
import { NotFoundError } from "modal";
import { getProject, deleteProject } from "@/lib/server/projectStore";
import {
  createModalClient,
  deleteProjectVolume,
} from "@/lib/server/modal";
import { deleteProjectRepo } from "@/lib/server/github";
import { clearAgentState } from "@/lib/server/agent-state-store";
import {
  withAsyncParams,
  successResponse,
  internalErrorResponse,
} from "@/lib/server/api-utils";
import type { DeleteProjectResponse } from "@/types/api";

// DELETE /api/projects/[id] - Delete project and its sandbox
export const DELETE = withAsyncParams<DeleteProjectResponse>(async (request, user, params) => {
  try {
    const { id: projectId } = params;
    const project = await getProject(projectId, user.id);

    // Make deletion idempotent: if project doesn't exist, return success
    // This handles stale UI state gracefully
    if (!project) {
      return successResponse({
        projectId,
        sandboxTerminated: false,
        sandboxAlreadyMissing: false,
        projectAlreadyDeleted: true,
        message: "Project already deleted",
      });
    }

    let sandboxTerminated = false;
    let sandboxAlreadyMissing = false;
    let volumeDeleted = false;
    let volumeAlreadyMissing = false;
    let githubRepoDeleted = false;
    let githubRepoAlreadyMissing = false;

    const modal = createModalClient();

    // Terminate sandbox if it exists
    if (project.currentSandboxId) {
      try {
        const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);
        await sandbox.terminate();
        sandboxTerminated = true;
        console.log(
          "[projects] Terminated sandbox:",
          project.currentSandboxId,
          "for project:",
          projectId
        );
      } catch (error) {
        if (error instanceof NotFoundError) {
          sandboxAlreadyMissing = true;
          console.log(
            "[projects] Sandbox already missing:",
            project.currentSandboxId
          );
        } else {
          console.error("[projects] Error terminating sandbox:", error);
          return internalErrorResponse(error);
        }
      }
    }

    // Delete volume if it exists
    if (project.modalVolumeId) {
      const volumeName = `dyno-project-${projectId}`;
      try {
        const result = await deleteProjectVolume(modal, volumeName);
        volumeDeleted = result.deleted;
        volumeAlreadyMissing = result.alreadyMissing;
        console.log(
          "[projects] Volume deletion result:",
          volumeName,
          "deleted:",
          volumeDeleted,
          "alreadyMissing:",
          volumeAlreadyMissing
        );
      } catch (error) {
        // Log error but don't fail project deletion (defensive approach)
        console.error(
          "[projects] Error deleting volume:",
          volumeName,
          "error:",
          error
        );
        // Continue with project deletion even if volume deletion fails
      }
    }

    // Delete backing GitHub repository (best-effort, non-fatal)
    try {
      const githubResult = await deleteProjectRepo({ projectId });
      githubRepoDeleted = githubResult.ok && !githubResult.notFound;
      githubRepoAlreadyMissing = !!githubResult.notFound;

      if (!githubResult.ok) {
        console.error(
          "[projects] Error deleting GitHub repo for project:",
          projectId,
          "status:",
          githubResult.status,
          "message:",
          githubResult.message
        );
      }
    } catch (error) {
      // Log error but don't fail project deletion
      console.error(
        "[projects] Error deleting GitHub repo for project:",
        projectId,
        "error:",
        error
      );
    }

    // Clear agent state for this project
    clearAgentState(projectId);
    console.log("[projects] Cleared agent state for project:", projectId);

    // Delete the project
    await deleteProject(projectId, user.id);

    console.log("[projects] Deleted project:", projectId);

    return successResponse({
      projectId,
      sandboxTerminated,
      sandboxAlreadyMissing,
      volumeDeleted,
      volumeAlreadyMissing,
      githubRepoDeleted,
      githubRepoAlreadyMissing,
      message: "Project, sandbox, volume, and GitHub repo deleted (where applicable)",
    });
  } catch (error) {
    console.error("[projects] Error handling delete request:", error);
    return internalErrorResponse(error);
  }
});

