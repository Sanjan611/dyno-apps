import { NextRequest, NextResponse } from "next/server";
import {
  createModalClient,
  createSandbox,
  checkSandboxExists,
  createErrorResponse,
} from "@/lib/server/modal";
import { NotFoundError } from "modal";
import { getProject, updateProjectSandboxId } from "@/lib/server/projectStore";
import { getAuthenticatedUser } from "@/lib/supabase/server";

// POST /api/projects/[id]/sandbox - Create or get existing sandbox
export async function POST(
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
    const project = await getProject(projectId, user.id);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    const modal = createModalClient();

    // If project already has a sandboxId, check if it's healthy
    if (project.currentSandboxId) {
      const exists = await checkSandboxExists(modal, project.currentSandboxId);

      if (exists) {
        // Try to verify it's accessible
        try {
          const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);
          
          // Check if we can access it (basic health check)
          try {
            await sandbox.tunnels(2000);
            
            console.log(
              "[sandbox] Reusing existing sandbox:",
              project.currentSandboxId
            );
            return NextResponse.json({
              success: true,
              sandboxId: project.currentSandboxId,
              status: "reused",
              message: "Using existing sandbox",
            });
          } catch (error) {
            // Sandbox exists but might not be fully ready, still return it
            console.log(
              "[sandbox] Sandbox exists but tunnel not ready:",
              project.currentSandboxId
            );
            return NextResponse.json({
              success: true,
              sandboxId: project.currentSandboxId,
              status: "reused",
              message: "Using existing sandbox (may still be initializing)",
            });
          }
        } catch (error) {
          // Sandbox exists but we can't access it, create a new one
          console.log(
            "[sandbox] Existing sandbox inaccessible, creating new one"
          );
        }
      } else {
        // Sandbox doesn't exist anymore, create a new one
        console.log(
          "[sandbox] Previous sandbox no longer exists, creating new one"
        );
      }
    }

    // Create a new sandbox
    console.log("[sandbox] Creating new sandbox for project:", projectId);
    const { sandbox } = await createSandbox(modal);

    // Update project with new sandboxId
    const updatedProject = await updateProjectSandboxId(projectId, user.id, sandbox.sandboxId);

    if (!updatedProject) {
      // This shouldn't happen, but handle it gracefully
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update project with sandboxId",
        },
        { status: 500 }
      );
    }

    console.log(
      "[sandbox] Created sandbox:",
      sandbox.sandboxId,
      "for project:",
      projectId
    );

    return NextResponse.json({
      success: true,
      sandboxId: sandbox.sandboxId,
      status: "created",
      message: "New sandbox created successfully",
    });
  } catch (error) {
    console.error("[sandbox] Error creating/getting sandbox:", error);
    return createErrorResponse(error, 500);
  }
}

// GET /api/projects/[id]/sandbox - Get sandbox info and status
export async function GET(
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
    const project = await getProject(projectId, user.id);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    if (!project.currentSandboxId) {
      return NextResponse.json({
        success: true,
        sandboxId: null,
        status: "not_created",
        message: "Sandbox has not been created for this project",
      });
    }

    const modal = createModalClient();
    const exists = await checkSandboxExists(modal, project.currentSandboxId);

    if (!exists) {
      return NextResponse.json({
        success: true,
        sandboxId: project.currentSandboxId,
        status: "not_found",
        message: "Sandbox no longer exists",
      });
    }

    try {
      const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);
      
      // Get tunnel info if available
      let previewUrl: string | null = null;
      try {
        const tunnels = await sandbox.tunnels(5000);
        const tunnel = tunnels[19006];
        if (tunnel) {
          previewUrl = tunnel.url;
        }
      } catch (error) {
        // Tunnel might not be ready
      }

      return NextResponse.json({
        success: true,
        sandboxId: project.currentSandboxId,
        status: "active",
        previewUrl,
        message: "Sandbox is active",
      });
    } catch (error) {
      return NextResponse.json({
        success: true,
        sandboxId: project.currentSandboxId,
        status: "inaccessible",
        message: "Sandbox exists but is not accessible",
      });
    }
  } catch (error) {
    console.error("[sandbox] Error getting sandbox info:", error);
    return createErrorResponse(error, 500);
  }
}

// DELETE /api/projects/[id]/sandbox - Terminate sandbox (keep project, clear sandboxId)
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
    const project = await getProject(projectId, user.id);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    if (!project.currentSandboxId) {
      // Project has no sandbox, return success (idempotent)
      return NextResponse.json({
        success: true,
        projectId,
        sandboxTerminated: false,
        sandboxAlreadyMissing: true,
        message: "Project has no associated sandbox",
      });
    }

    const modal = createModalClient();
    let sandboxTerminated = false;
    let sandboxAlreadyMissing = false;

    try {
      const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);
      await sandbox.terminate();
      sandboxTerminated = true;
      console.log("[sandbox] Terminated sandbox:", project.currentSandboxId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        sandboxAlreadyMissing = true;
        console.log(
          "[sandbox] Sandbox already missing:",
          project.currentSandboxId
        );
      } else {
        console.error("[sandbox] Error terminating sandbox:", error);
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

    // Clear sandboxId from project
    await updateProjectSandboxId(projectId, user.id, null);

    return NextResponse.json({
      success: true,
      projectId,
      sandboxTerminated,
      sandboxAlreadyMissing,
      message: "Sandbox terminated and removed from project",
    });
  } catch (error) {
    console.error("[sandbox] Error handling delete request:", error);
    return createErrorResponse(error, 500);
  }
}

