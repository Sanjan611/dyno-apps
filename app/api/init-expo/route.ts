import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";
import { readFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const { sandboxId } = await request.json();
    console.log("[init-expo] Starting Expo initialization for sandbox:", sandboxId);

    if (!sandboxId) {
      console.error("[init-expo] Error: sandboxId is required");
      return NextResponse.json(
        {
          success: false,
          error: "sandboxId is required",
        },
        { status: 400 }
      );
    }

    // Modal credentials are read from environment variables
    const modal = new ModalClient({
      tokenId: process.env.MODAL_TOKEN_ID,
      tokenSecret: process.env.MODAL_TOKEN_SECRET,
    });

    // Get the sandbox reference
    console.log("[init-expo] Getting sandbox reference...");
    const sandbox = await modal.sandboxes.fromId(sandboxId);
    console.log("[init-expo] Sandbox reference obtained:", sandbox.sandboxId);

    // Read the startup script from local filesystem
    const scriptPath = join(process.cwd(), "scripts", "startup.sh");
    console.log("[init-expo] Reading startup script from:", scriptPath);
    const scriptContent = await readFile(scriptPath, "utf-8");
    console.log("[init-expo] Startup script read, length:", scriptContent.length);

    // Create the startup script in the sandbox filesystem
    console.log("[init-expo] Writing startup script to sandbox...");
    const file = await sandbox.open("/startup.sh", "w");
    await file.write(new TextEncoder().encode(scriptContent));
    await file.close();
    console.log("[init-expo] Startup script written to sandbox");

    // Make the script executable
    console.log("[init-expo] Making script executable...");
    const chmodProcess = await sandbox.exec(["chmod", "+x", "/startup.sh"]);
    await chmodProcess.wait();
    console.log("[init-expo] Script is now executable");

    // Execute the startup script and capture output
    console.log("[init-expo] Executing startup script...");
    const execProcess = await sandbox.exec(["/bin/bash", "/startup.sh"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    // Read stdout and stderr in parallel
    const [stdout, stderr] = await Promise.all([
      execProcess.stdout.readText().catch(() => ""),
      execProcess.stderr.readText().catch(() => ""),
    ]);

    console.log("[init-expo] Script execution output:");
    console.log("[init-expo] STDOUT:", stdout);
    console.log("[init-expo] STDERR:", stderr);

    // Wait a bit for Expo to start
    console.log("[init-expo] Waiting 15 seconds for Expo to start...");
    await new Promise((resolve) => setTimeout(resolve, 15000));

    // Wait for sandbox tunnels to be available (with timeout)
    console.log("[init-expo] Waiting for sandbox tunnels...");
    const tunnels = await sandbox.tunnels(60000); // Wait up to 60 seconds
    console.log("[init-expo] Tunnels available:", Object.keys(tunnels));
    
    const tunnel = tunnels[19006];

    if (!tunnel) {
      console.error("[init-expo] Error: Tunnel for port 19006 not available");
      console.error("[init-expo] Available tunnels:", Object.keys(tunnels));
      return NextResponse.json(
        {
          success: false,
          error: "Tunnel for port 19006 not available",
          availablePorts: Object.keys(tunnels).map(Number),
          logs: { stdout, stderr },
        },
        { status: 500 }
      );
    }

    const previewUrl = tunnel.url;
    console.log("[init-expo] Preview URL obtained:", previewUrl);

    return NextResponse.json({
      success: true,
      previewUrl,
      logs: { stdout, stderr },
    });
  } catch (error) {
    console.error("[init-expo] Error initializing Expo:", error);
    if (error instanceof Error) {
      console.error("[init-expo] Error stack:", error.stack);
    }
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

