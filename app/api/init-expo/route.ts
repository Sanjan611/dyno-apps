import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";
import { readFile } from "fs/promises";
import { join } from "path";
import { EXPO_PORT, TIMEOUTS } from "@/lib/constants";

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

    // Execute the startup script (don't wait for output, let it run in background)
    console.log("[init-expo] Executing startup script...");
    const execProcess = await sandbox.exec(["/bin/bash", "/startup.sh"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    // Don't block on reading all output - just let it run
    // The script uses nohup so Expo runs in background anyway

    // Poll for tunnel availability with exponential backoff
    console.log("[init-expo] Polling for tunnel availability...");
    let tunnel = null;
    let previewUrl = null;
    const maxAttempts = 30;
    const baseDelay = TIMEOUTS.EXPO_INIT_BASE_DELAY;
    const startTime = Date.now();

    const formatElapsed = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return minutes > 0 
        ? `${minutes}m ${remainingSeconds}s` 
        : `${seconds}s`;
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const elapsed = Date.now() - startTime;
      console.log(`[init-expo] Attempt ${attempt}/${maxAttempts} (${formatElapsed(elapsed)} elapsed)...`);
      
      try {
        const tunnels = await sandbox.tunnels(TIMEOUTS.TUNNEL_CONNECTION);
        tunnel = tunnels[EXPO_PORT];
        
        if (tunnel) {
          previewUrl = tunnel.url;
          
          // Verify the URL is actually responding
          const response = await fetch(previewUrl, { 
            method: 'GET',
            signal: AbortSignal.timeout(TIMEOUTS.TUNNEL_FETCH) 
          });
          
          if (response.ok || response.status === 200) {
            const totalElapsed = Date.now() - startTime;
            console.log(`[init-expo] ✓ Expo ready after ${attempt} attempts (${formatElapsed(totalElapsed)} total)`);
            break;
          }
        }
      } catch (e) {
        // Expected during startup, continue polling
      }
      
      if (attempt < maxAttempts) {
        const delay = Math.min(baseDelay * (1 + attempt * 0.2), TIMEOUTS.EXPO_INIT_MAX_DELAY);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (!previewUrl) {
      return NextResponse.json({ success: false, error: "Expo failed to start" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      previewUrl,
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

