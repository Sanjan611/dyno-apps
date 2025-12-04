import { NextRequest } from "next/server";
import {
  createModalClient,
  createSandbox,
  checkSandboxExists,
  getOrCreateProjectVolume,
} from "@/lib/server/modal";
import { NotFoundError } from "modal";
import { getProject, updateProject, updateProjectSandboxId } from "@/lib/server/projectStore";
import {
  withAsyncParams,
  successResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/server/api-utils";
import { EXPO_PORT, TIMEOUTS } from "@/lib/constants";
import type { CreateSandboxResponse, GetSandboxResponse, TerminateSandboxResponse } from "@/types/api";

// POST /api/projects/[id]/sandbox - Create or get existing sandbox
export const POST = withAsyncParams<CreateSandboxResponse>(async (request, user, params) => {
  try {
    if (!params || !params.id) {
      return notFoundResponse("Project ID is required");
    }
    const projectId = typeof params.id === 'string' ? params.id : await params.id;
    console.log("[sandbox] Looking for project:", projectId, "for user:", user.id);

    const project = await getProject(projectId, user.id);

    if (!project) {
      console.log("[sandbox] Project not found for sandbox creation:", projectId);
      return notFoundResponse("Project not found");
    }

    console.log("[sandbox] Found existing project:", project.id, "title:", project.title);

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
            await sandbox.tunnels(TIMEOUTS.SANDBOX_QUICK_CHECK);
            
            console.log(
              "[sandbox] Reusing existing sandbox:",
              project.currentSandboxId
            );
            return successResponse({
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
            return successResponse({
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

    // Get or create volume for this project
    const volumeName = `dyno-project-${projectId}`;
    let volume = null;
    let isNewVolume = false;

    if (project.modalVolumeId) {
      // Project already has a volume, try to get it by name
      // (We store volumeId but Modal volumes are accessed by name)
      console.log("[sandbox] Project has existing volume, using:", project.modalVolumeId);
      try {
        volume = await getOrCreateProjectVolume(modal, volumeName);
        // Volume exists, will skip init
        isNewVolume = false;
      } catch (error) {
        console.log("[sandbox] Could not retrieve existing volume, creating new one");
        volume = await getOrCreateProjectVolume(modal, volumeName);
        isNewVolume = true;
      }
    } else {
      // New project, create new volume
      console.log("[sandbox] Creating new volume for project:", projectId);
      volume = await getOrCreateProjectVolume(modal, volumeName);
      isNewVolume = true;
    }

    // Create a new sandbox with volume attached
    console.log("[sandbox] Creating new sandbox for project:", projectId);
    const { sandbox } = await createSandbox(modal, volume);

    // Update project with new sandboxId and volumeId
    const updatedProject = await updateProject(projectId, user.id, {
      currentSandboxId: sandbox.sandboxId,
      modalVolumeId: volume.volumeId,
    });

    if (!updatedProject) {
      // This shouldn't happen, but handle it gracefully
      return internalErrorResponse(new Error("Failed to update project with sandboxId and volumeId"));
    }

    console.log(
      "[sandbox] Created sandbox:",
      sandbox.sandboxId,
      "with volume:",
      volume.volumeId,
      "for project:",
      projectId,
      isNewVolume ? "(new volume)" : "(existing volume)"
    );

    return successResponse({
      sandboxId: sandbox.sandboxId,
      status: "created",
      message: "New sandbox created successfully",
    });
  } catch (error) {
    console.error("[sandbox] Error creating/getting sandbox:", error);
    return internalErrorResponse(error);
  }
});

// GET /api/projects/[id]/sandbox - Get sandbox info and status
export const GET = withAsyncParams<GetSandboxResponse>(async (request, user, params) => {
  try {
    if (!params || !params.id) {
      return notFoundResponse("Project ID is required");
    }
    const projectId = typeof params.id === 'string' ? params.id : await params.id;
    const project = await getProject(projectId, user.id);

    if (!project) {
      return notFoundResponse("Project not found");
    }

    if (!project.currentSandboxId) {
      return successResponse({
        sandboxId: null,
        status: "not_created",
        message: "Sandbox has not been created for this project",
      });
    }

    const modal = createModalClient();
    const exists = await checkSandboxExists(modal, project.currentSandboxId);

    if (!exists) {
      return successResponse({
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
        const tunnels = await sandbox.tunnels(TIMEOUTS.TUNNEL_CONNECTION);
        const tunnel = tunnels[EXPO_PORT];
        if (tunnel) {
          previewUrl = tunnel.url;
        }
      } catch (error) {
        // Tunnel might not be ready
      }

      return successResponse({
        sandboxId: project.currentSandboxId,
        status: "active",
        previewUrl,
        message: "Sandbox is active",
      });
    } catch (error) {
      return successResponse({
        sandboxId: project.currentSandboxId,
        status: "inaccessible",
        message: "Sandbox exists but is not accessible",
      });
    }
  } catch (error) {
    console.error("[sandbox] Error getting sandbox info:", error);
    return internalErrorResponse(error);
  }
});

// DELETE /api/projects/[id]/sandbox - Terminate sandbox (keep project, clear sandboxId)
export const DELETE = withAsyncParams<TerminateSandboxResponse>(async (request, user, params) => {
  try {
    if (!params || !params.id) {
      return notFoundResponse("Project ID is required");
    }
    const projectId = typeof params.id === 'string' ? params.id : await params.id;
    const project = await getProject(projectId, user.id);

    if (!project) {
      return notFoundResponse("Project not found");
    }

    if (!project.currentSandboxId) {
      // Project has no sandbox, return success (idempotent)
      return successResponse({
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
        return internalErrorResponse(error);
      }
    }

    // Clear sandboxId from project
    await updateProjectSandboxId(projectId, user.id, null);

    return successResponse({
      projectId,
      sandboxTerminated,
      sandboxAlreadyMissing,
      message: "Sandbox terminated and removed from project",
    });
  } catch (error) {
    console.error("[sandbox] Error handling delete request:", error);
    return internalErrorResponse(error);
  }
});

