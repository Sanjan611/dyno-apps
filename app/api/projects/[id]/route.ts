import { NextRequest } from "next/server";
import { NotFoundError } from "modal";
import { getProject, deleteProject } from "@/lib/server/projectStore";
import {
  createModalClient,
} from "@/lib/server/modal";
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

    // Terminate sandbox if it exists
    if (project.currentSandboxId) {
      try {
        const modal = createModalClient();
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

    // Delete the project
    await deleteProject(projectId, user.id);

    console.log("[projects] Deleted project:", projectId);

    return successResponse({
      projectId,
      sandboxTerminated,
      sandboxAlreadyMissing,
      message: "Project and sandbox deleted successfully",
    });
  } catch (error) {
    console.error("[projects] Error handling delete request:", error);
    return internalErrorResponse(error);
  }
});

