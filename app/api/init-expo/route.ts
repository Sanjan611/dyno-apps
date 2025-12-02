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
    const maxAttempts = 30; // 30 attempts
    const baseDelay = 2000; // Start with 2 seconds
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
        const tunnels = await sandbox.tunnels(5000); // Short timeout per attempt
        tunnel = tunnels[19006];
        
        if (tunnel) {
          previewUrl = tunnel.url;
          
          // Verify the URL is actually responding
          const response = await fetch(previewUrl, { 
            method: 'GET',
            signal: AbortSignal.timeout(3000) 
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
        const delay = Math.min(baseDelay * (1 + attempt * 0.2), 5000); // Cap at 5s
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (!previewUrl) {
      return NextResponse.json({ success: false, error: "Expo failed to start" }, { status: 500 });
    }

    // Get Expo connection URL for native/Expo Go from Expo's tunnel (ngrok)
    // When using --tunnel, Expo creates its own ngrok tunnel and prints the URL to log
    let expoConnectionUrl: string | null = null;
    try {
      // Wait a bit for Expo to establish tunnel and print URL
      await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds for tunnel setup
      
      // Read from Expo log to extract the tunnel URL
      try {
        const logFile = await sandbox.open("/tmp/expo.log", "r");
        const logContent = await logFile.read();
        const logText = new TextDecoder().decode(logContent);
        await logFile.close();
        
        // Look for Expo tunnel URL patterns
        const patterns = [
          /Run\s+with\s+Expo\s+Go[:\s]+(exp:\/\/[^\s]+)/i,
          /Metro\s+waiting\s+on\s+(exp:\/\/[^\s]+)/i,
          /Tunnel\s+ready[\.\s]+(exp:\/\/[^\s]+)/i,
          /(exp:\/\/[a-zA-Z0-9\-\.]+(?::\d+)?(?:\/[^\s"]*)?)/g,
        ];
        
        for (const pattern of patterns) {
          const matches = logText.match(pattern);
          if (matches && matches.length > 0) {
            let url = Array.isArray(matches) ? (matches[1] || matches[0]) : matches[0];
            if (url && url.startsWith("exp://")) {
              const cleanUrl = url.split(/[\s\)\]\}\"',\n\r]/)[0];
              if (cleanUrl.includes(":") && cleanUrl.split(":").length >= 3) {
                expoConnectionUrl = cleanUrl;
                console.log("[init-expo] Found Expo tunnel URL in log:", expoConnectionUrl);
                break;
              }
            }
          }
        }
        
        // Try ngrok domain pattern
        if (!expoConnectionUrl) {
          const ngrokPattern = /exp:\/\/[a-zA-Z0-9\-]+\.(ngrok|ngrok-free|ngrok\.app|eu\.ngrok\.io)[^\s]*/i;
          const ngrokMatch = logText.match(ngrokPattern);
          if (ngrokMatch) {
            expoConnectionUrl = ngrokMatch[0].split(/[\s\)\]\}\"',\n\r]/)[0];
            console.log("[init-expo] Found Expo ngrok URL in log:", expoConnectionUrl);
          }
        }
      } catch (logError) {
        console.log("[init-expo] Could not read Expo log:", logError);
      }
      
      // Fallback: Try Expo status endpoint
      if (!expoConnectionUrl) {
        try {
          const statusProcess = await sandbox.exec([
            "curl",
            "-s",
            "--max-time",
            "3",
            "http://localhost:19000/status",
          ]);
          
          const statusOutput = await statusProcess.stdout.readText();
          await statusProcess.wait();
          
          if (statusOutput) {
            try {
              const statusData = JSON.parse(statusOutput);
              if (statusData.expoGoConnectionUrl) {
                expoConnectionUrl = statusData.expoGoConnectionUrl;
              } else if (statusData.expUrl) {
                expoConnectionUrl = statusData.expUrl;
              } else if (statusData.manifestUrl && statusData.manifestUrl.startsWith("exp://")) {
                expoConnectionUrl = statusData.manifestUrl;
              }
            } catch (parseError) {
              // Not JSON
            }
          }
        } catch (statusError) {
          // Status endpoint not available
        }
      }
    } catch (error) {
      console.log("[init-expo] Could not get Expo connection URL:", error);
      // Continue without connection URL - it can be fetched later
    }

    return NextResponse.json({
      success: true,
      previewUrl,
      expoConnectionUrl,
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

