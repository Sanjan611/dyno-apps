import { NextRequest, NextResponse } from "next/server";
import { ModalClient, NotFoundError } from "modal";
import { deleteProject, getProject } from "@/lib/server/projectStore";

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: "projectId is required",
        },
        { status: 400 }
      );
    }

    const project = getProject(projectId);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    let sandboxTerminated = false;
    let sandboxAlreadyMissing = false;

    if (project.sandboxId) {
      try {
        const modal = new ModalClient({
          tokenId: process.env.MODAL_TOKEN_ID,
          tokenSecret: process.env.MODAL_TOKEN_SECRET,
        });
        const sandbox = await modal.sandboxes.fromId(project.sandboxId);
        await sandbox.terminate();
        sandboxTerminated = true;
      } catch (error) {
        if (error instanceof NotFoundError) {
          sandboxAlreadyMissing = true;
        } else {
          console.error("[delete-sandbox] Error terminating sandbox:", error);
          return NextResponse.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Failed to terminate sandbox",
            },
            { status: 500 }
          );
        }
      }
    }

    deleteProject(projectId);

    return NextResponse.json({
      success: true,
      projectId,
      sandboxTerminated,
      sandboxAlreadyMissing,
    });
  } catch (error) {
    console.error("[delete-sandbox] Error handling request:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

