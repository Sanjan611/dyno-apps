import { NextRequest, NextResponse } from "next/server";
import { createModalClient, checkSandboxExists, createErrorResponse } from "@/lib/server/modal";
import { getProject } from "@/lib/server/projectStore";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { EXPO_PORT, TIMEOUTS } from "@/lib/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // If project has no sandboxId, return not created status
    if (!project.currentSandboxId) {
      return NextResponse.json({
        success: true,
        healthy: false,
        exists: false,
        status: "not_created",
        message: "Sandbox has not been created for this project",
      });
    }

    const modal = createModalClient();
    const exists = await checkSandboxExists(modal, project.currentSandboxId);

    if (!exists) {
      return NextResponse.json({
        success: true,
        healthy: false,
        exists: false,
        status: "not_found",
        message: "Sandbox no longer exists",
        sandboxId: project.currentSandboxId,
      });
    }

    // Try to get the sandbox to check if it's accessible
    try {
      const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);

      // Optional: Check if Expo process is running
      let expoRunning = false;
      let portListening = false;

      try {
        // Check if Expo port is listening
        const netstatProcess = await sandbox.exec(["netstat", "-tlnp"]);
        const netstatOutput = await netstatProcess.stdout.readText();
        await netstatProcess.wait();
        portListening = netstatOutput.includes(`:${EXPO_PORT}`);
      } catch (error) {
        // If we can't check, assume unknown
        console.log("[sandbox-health] Could not check port status:", error);
      }

      try {
        // Check if Expo process is running
        const psProcess = await sandbox.exec(["ps", "aux"]);
        const psOutput = await psProcess.stdout.readText();
        await psProcess.wait();
        expoRunning = psOutput.includes("expo") || psOutput.includes("node");
      } catch (error) {
        // If we can't check, assume unknown
        console.log("[sandbox-health] Could not check process status:", error);
      }

      // Get tunnel info if available
      let previewUrl: string | null = null;
      try {
        const tunnels = await sandbox.tunnels(TIMEOUTS.TUNNEL_CONNECTION);
        const tunnel = tunnels[EXPO_PORT];
        if (tunnel) {
          previewUrl = tunnel.url;
        }
      } catch (error) {
        // Tunnel might not be ready yet
        console.log("[sandbox-health] Could not get tunnel info:", error);
      }

      const healthy = portListening || expoRunning;

      return NextResponse.json({
        success: true,
        healthy,
        exists: true,
        status: healthy ? "healthy" : "unhealthy",
        sandboxId: project.currentSandboxId,
        checks: {
          portListening,
          expoRunning,
        },
        previewUrl,
        message: healthy
          ? "Sandbox is healthy and operational"
          : "Sandbox exists but may not be fully operational",
      });
    } catch (error) {
      // Sandbox exists but we can't access it
      return NextResponse.json({
        success: true,
        healthy: false,
        exists: true,
        status: "inaccessible",
        sandboxId: project.currentSandboxId,
        message: "Sandbox exists but is not accessible",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("[sandbox-health] Error checking sandbox health:", error);
    return createErrorResponse(error, 500);
  }
}

