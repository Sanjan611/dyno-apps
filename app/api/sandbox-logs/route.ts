import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";
import { SANDBOX_WORKING_DIR } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sandboxId = searchParams.get("sandboxId");

    if (!sandboxId) {
      return NextResponse.json(
        {
          success: false,
          error: "sandboxId query parameter is required",
        },
        { status: 400 }
      );
    }

    console.log("[sandbox-logs] Fetching logs for sandbox:", sandboxId);

    // Modal credentials are read from environment variables
    const modal = new ModalClient({
      tokenId: process.env.MODAL_TOKEN_ID,
      tokenSecret: process.env.MODAL_TOKEN_SECRET,
    });

    // Get the sandbox reference
    const sandbox = await modal.sandboxes.fromId(sandboxId);

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
      const psProcess = await sandbox.exec(["ps", "aux"]);
      const psOutput = await psProcess.stdout.readText();
      processCheck = psOutput;
    } catch (error) {
      console.log("[sandbox-logs] Could not check processes:", error);
    }

    // Try to check if port 19006 is listening
    let portCheck = "";
    try {
      const netstatProcess = await sandbox.exec(["netstat", "-tlnp"]);
      const netstatOutput = await netstatProcess.stdout.readText();
      portCheck = netstatOutput;
    } catch (error) {
      // netstat might not be available, try ss instead
      try {
        const ssProcess = await sandbox.exec(["ss", "-tlnp"]);
        const ssOutput = await ssProcess.stdout.readText();
        portCheck = ssOutput;
      } catch (err) {
        console.log("[sandbox-logs] Could not check ports:", err);
      }
    }

    // Try to check if the app directory exists
    let appDirCheck = "";
    try {
      const lsProcess = await sandbox.exec(["ls", "-la", SANDBOX_WORKING_DIR]);
      const lsOutput = await lsProcess.stdout.readText();
      appDirCheck = lsOutput;
    } catch (error) {
      console.log("[sandbox-logs] Could not check app directory:", error);
    }

    return NextResponse.json({
      success: true,
      logs: {
        expoLogs,
        processCheck,
        portCheck,
        appDirCheck,
      },
    });
  } catch (error) {
    console.error("[sandbox-logs] Error fetching logs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}


