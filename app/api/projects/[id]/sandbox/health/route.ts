import { NextRequest, NextResponse } from "next/server";
import { createModalClient, checkSandboxExists, createErrorResponse } from "@/lib/server/modal";
import { getProject } from "@/lib/server/projectStore";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
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

    // If project has no sandboxId, return not created status
    if (!project.sandboxId) {
      return NextResponse.json({
        success: true,
        healthy: false,
        exists: false,
        status: "not_created",
        message: "Sandbox has not been created for this project",
      });
    }

    const modal = createModalClient();
    const exists = await checkSandboxExists(modal, project.sandboxId);

    if (!exists) {
      return NextResponse.json({
        success: true,
        healthy: false,
        exists: false,
        status: "not_found",
        message: "Sandbox no longer exists",
        sandboxId: project.sandboxId,
      });
    }

    // Try to get the sandbox to check if it's accessible
    try {
      const sandbox = await modal.sandboxes.fromId(project.sandboxId);

      // Optional: Check if Expo process is running
      let expoRunning = false;
      let portListening = false;

      try {
        // Check if port 19006 is listening
        const netstatProcess = await sandbox.exec(["netstat", "-tlnp"]);
        const netstatOutput = await netstatProcess.stdout.readText();
        await netstatProcess.wait();
        portListening = netstatOutput.includes(":19006");
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
      // We use Modal tunnel for web preview (port 19006)
      // Expo connection URL uses Expo's own tunnel (ngrok) - fetch via /expo-connection endpoint
      let previewUrl: string | null = null;
      let expoConnectionUrl: string | null = null;
      try {
        const tunnels = await sandbox.tunnels(5000);
        const tunnel = tunnels[19006];
        if (tunnel) {
          previewUrl = tunnel.url;
        }
        
        // Expo connection URL is not available here - it uses Expo's tunnel (ngrok)
        // Use the /expo-connection endpoint to get the actual Expo tunnel URL
        expoConnectionUrl = null;
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
        sandboxId: project.sandboxId,
        checks: {
          portListening,
          expoRunning,
        },
        previewUrl,
        expoConnectionUrl,
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
        sandboxId: project.sandboxId,
        message: "Sandbox exists but is not accessible",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("[sandbox-health] Error checking sandbox health:", error);
    return createErrorResponse(error, 500);
  }
}

