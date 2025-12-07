import { NextRequest } from "next/server";
import { createModalClient } from "@/lib/server/modal";
import { getProject } from "@/lib/server/projectStore";
import {
  withAsyncParams,
  successResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/server/api-utils";
import { SANDBOX_WORKING_DIR, REPO_DIR } from "@/lib/constants";
import type { SandboxLogsResponse } from "@/types/api";

// GET /api/projects/[id]/sandbox/logs - Get sandbox logs
export const GET = withAsyncParams<SandboxLogsResponse>(async (request, user, params) => {
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
      return notFoundResponse("Project has no associated sandbox");
    }

    console.log("[sandbox-logs] Fetching logs for sandbox:", project.currentSandboxId, "project:", projectId);

    const modal = createModalClient();

    // Get the sandbox reference
    const sandbox = await modal.sandboxes.fromId(project.currentSandboxId);

    // Try to read the Expo log file if it exists
    let expoLogs = "";
    try {
      const logFile = await sandbox.open("/tmp/expo.log", "r");
      const logContent = await logFile.read();
      expoLogs = new TextDecoder().decode(logContent);
      await logFile.close();
    } catch (error) {
      console.log("[sandbox-logs] Could not read expo.log:", error);
    }

    // Try to check if Expo process is running
    let processCheck = "";
    try {
      const psProcess = await sandbox.exec(["ps", "aux"], { workdir: REPO_DIR });
      const psOutput = await psProcess.stdout.readText();
      processCheck = psOutput;
    } catch (error) {
      console.log("[sandbox-logs] Could not check processes:", error);
    }

    // Try to check if port 19006 is listening
    let portCheck = "";
    try {
      const netstatProcess = await sandbox.exec(["netstat", "-tlnp"], { workdir: REPO_DIR });
      const netstatOutput = await netstatProcess.stdout.readText();
      portCheck = netstatOutput;
    } catch (error) {
      // netstat might not be available, try ss instead
      try {
        const ssProcess = await sandbox.exec(["ss", "-tlnp"], { workdir: REPO_DIR });
        const ssOutput = await ssProcess.stdout.readText();
        portCheck = ssOutput;
      } catch (err) {
        console.log("[sandbox-logs] Could not check ports:", err);
      }
    }

    // Try to check if the app directory exists
    let appDirCheck = "";
    try {
      const lsProcess = await sandbox.exec(["ls", "-la", SANDBOX_WORKING_DIR], { workdir: REPO_DIR });
      const lsOutput = await lsProcess.stdout.readText();
      appDirCheck = lsOutput;
    } catch (error) {
      console.log("[sandbox-logs] Could not check app directory:", error);
    }

    return successResponse({
      logs: {
        expoLogs,
        processCheck,
        portCheck,
        appDirCheck,
      },
    });
  } catch (error) {
    console.error("[sandbox-logs] Error fetching logs:", error);
    return internalErrorResponse(error);
  }
});

