import { NextRequest, NextResponse } from "next/server";
import { NotFoundError } from "modal";
import {
  getProject,
  deleteProject,
} from "@/lib/server/projectStore";
import {
  createModalClient,
  createErrorResponse,
} from "@/lib/server/modal";
import { getAuthenticatedUser } from "@/lib/supabase/server";

// DELETE /api/projects/[id] - Delete project and its sandbox
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);

    // Make deletion idempotent: if project doesn't exist, return success
    // This handles stale UI state gracefully
    if (!project) {
      return NextResponse.json({
        success: true,
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
    if (project.sandboxId) {
      try {
        const modal = createModalClient();
        const sandbox = await modal.sandboxes.fromId(project.sandboxId);
        await sandbox.terminate();
        sandboxTerminated = true;
        console.log(
          "[projects] Terminated sandbox:",
          project.sandboxId,
          "for project:",
          projectId
        );
      } catch (error) {
        if (error instanceof NotFoundError) {
          sandboxAlreadyMissing = true;
          console.log(
            "[projects] Sandbox already missing:",
            project.sandboxId
          );
        } else {
          console.error("[projects] Error terminating sandbox:", error);
          return NextResponse.json(
            {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to terminate sandbox",
            },
            { status: 500 }
          );
        }
      }
    }

    // Delete the project
    deleteProject(projectId);

    console.log("[projects] Deleted project:", projectId);

    return NextResponse.json({
      success: true,
      projectId,
      sandboxTerminated,
      sandboxAlreadyMissing,
      message: "Project and sandbox deleted successfully",
    });
  } catch (error) {
    console.error("[projects] Error handling delete request:", error);
    return createErrorResponse(error, 500);
  }
}

