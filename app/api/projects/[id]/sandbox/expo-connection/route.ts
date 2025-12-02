import { NextRequest, NextResponse } from "next/server";
import { createModalClient, checkSandboxExists, createErrorResponse } from "@/lib/server/modal";
import { getProject } from "@/lib/server/projectStore";

// Helper function to get Expo connection URL from Expo's tunnel (ngrok)
async function getExpoConnectionUrl(sandbox: any, webPreviewUrl: string | null): Promise<string | null> {
  try {
    // When using --tunnel, Expo creates its own ngrok tunnels
    // We need to extract the actual exp:// URL from Expo's output
    
    // First, try to read from Expo log - Expo prints the tunnel URL here
    try {
      const logFile = await sandbox.open("/tmp/expo.log", "r");
      const logContent = await logFile.read();
      const logText = new TextDecoder().decode(logContent);
      await logFile.close();
      
      console.log("[expo-connection] Log file size:", logText.length, "chars");
      
      // Expo prints the connection URL in various formats:
      // Look for patterns like:
      // - "exp://..."
      // - "Metro waiting on exp://..."
      // - "Tunnel ready. exp://..."
      // - "Run with Expo Go: exp://..."
      // - QR code output with exp:// URL
      const patterns = [
        // Most specific patterns first - with capture groups
        /Run\s+with\s+Expo\s+Go[:\s]+(exp:\/\/[^\s\)\]\}]+)/i,
        /Metro\s+waiting\s+on\s+(exp:\/\/[^\s\)\]\}]+)/i,
        /Tunnel\s+ready[\.\s]+(exp:\/\/[^\s\)\]\}]+)/i,
        /Connection\s+URL[:\s]+(exp:\/\/[^\s\)\]\}]+)/i,
        /Connect\s+to\s+the\s+development\s+server[:\s]+(exp:\/\/[^\s\)\]\}]+)/i,
        // Look for QR code output lines
        /\│\s*exp:\/\/[^\s│]+/g,
        // General exp:// URL pattern
        /(exp:\/\/[a-zA-Z0-9\-\.]+(?::\d+)?)/g,
      ];
      
      for (const pattern of patterns) {
        const matches = logText.match(pattern);
        if (matches && matches.length > 0) {
          for (const match of matches) {
            // Extract URL from match (could be full match or capture group)
            let url = match;
            // If pattern has capture group, extract it
            const captureMatch = match.match(/exp:\/\/[^\s\)\]\}]+/);
            if (captureMatch) {
              url = captureMatch[0];
            }
            
            if (url && url.startsWith("exp://")) {
              // Clean up the URL
              let cleanUrl = url.trim().split(/[\s\)\]\}\"',\n\r│]/)[0];
              // Remove any trailing characters
              cleanUrl = cleanUrl.replace(/[^\w:\-\.\/]+$/g, '');
              
              // Validate it looks like a proper exp:// URL
              if (cleanUrl.match(/^exp:\/\/[a-zA-Z0-9\-\.]+(:\d+)?/)) {
                console.log("[expo-connection] Found Expo tunnel URL in log:", cleanUrl);
                return cleanUrl;
              }
            }
          }
        }
      }
      
      // Try a more aggressive pattern - find any exp:// URL with ngrok domain
      const ngrokPatterns = [
        /exp:\/\/[a-zA-Z0-9\-]+\.ngrok-free\.app[^\s\)\]\}]*/gi,
        /exp:\/\/[a-zA-Z0-9\-]+\.ngrok\.app[^\s\)\]\}]*/gi,
        /exp:\/\/[a-zA-Z0-9\-]+\.eu\.ngrok\.io[^\s\)\]\}]*/gi,
        /exp:\/\/[a-zA-Z0-9\-]+\.ngrok[^\s\)\]\}]*/gi,
      ];
      
      for (const ngrokPattern of ngrokPatterns) {
        const ngrokMatch = logText.match(ngrokPattern);
        if (ngrokMatch && ngrokMatch.length > 0) {
          const cleanUrl = ngrokMatch[0].split(/[\s\)\]\}\"',\n\r│]/)[0].trim();
          console.log("[expo-connection] Found Expo ngrok URL in log:", cleanUrl);
          return cleanUrl;
        }
      }
      
      // Log last 500 chars of log for debugging
      const logSnippet = logText.slice(-500);
      console.log("[expo-connection] Log snippet (last 500 chars):", logSnippet);
    } catch (logError) {
      console.log("[expo-connection] Could not read Expo log:", logError);
    }
    
    // Try to query Expo's status/manifest endpoints
    try {
      // Try Expo dev server endpoints
      const endpoints = [
        "http://localhost:19000",
        "http://localhost:19000/status",
        "http://localhost:19000/status/json",
        "http://localhost:8081/status",
        "http://localhost:8081/status/json",
      ];
      
      for (const endpoint of endpoints) {
        try {
          const statusProcess = await sandbox.exec([
            "curl",
            "-s",
            "--max-time",
            "5",
            endpoint,
          ]);
          
          const statusOutput = await statusProcess.stdout.readText();
          const exitCode = await statusProcess.wait();
          
          if (exitCode === 0 && statusOutput && statusOutput.trim()) {
            try {
              const statusData = JSON.parse(statusOutput);
              console.log("[expo-connection] Status endpoint response:", JSON.stringify(statusData).slice(0, 200));
              
              // Check for various possible field names in status response
              const possibleFields = [
                'expoGoConnectionUrl',
                'expUrl',
                'exp',
                'url',
                'manifestUrl',
                'expo.url',
                'expo.expUrl',
              ];
              
              for (const field of possibleFields) {
                const parts = field.split('.');
                let value = statusData;
                for (const part of parts) {
                  value = value?.[part];
                  if (!value) break;
                }
                
                if (value && typeof value === 'string' && value.startsWith("exp://")) {
                  console.log("[expo-connection] Found URL in status field:", field, value);
                  return value;
                }
              }
            } catch (parseError) {
              // Not JSON or invalid JSON - check if it's HTML/plain text with exp:// URL
              const urlMatch = statusOutput.match(/(exp:\/\/[a-zA-Z0-9\-\.]+(?::\d+)?)/);
              if (urlMatch) {
                console.log("[expo-connection] Found URL in non-JSON response:", urlMatch[1]);
                return urlMatch[1];
              }
            }
          }
        } catch (endpointError) {
          // Try next endpoint
          continue;
        }
      }
    } catch (statusError) {
      console.log("[expo-connection] Could not query Expo status endpoints:", statusError);
    }
    
    return null;
  } catch (error) {
    console.log("[expo-connection] Error getting connection URL:", error);
    return null;
  }
}

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

    if (!project.sandboxId) {
      return NextResponse.json({
        success: false,
        error: "Sandbox has not been created for this project",
      }, { status: 404 });
    }

    const modal = createModalClient();
    const exists = await checkSandboxExists(modal, project.sandboxId);

    if (!exists) {
      return NextResponse.json({
        success: false,
        error: "Sandbox no longer exists",
      }, { status: 404 });
    }

    try {
      const sandbox = await modal.sandboxes.fromId(project.sandboxId);
      
      // Get web preview URL
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

      // Get Expo connection URL
      const expoConnectionUrl = await getExpoConnectionUrl(sandbox, previewUrl);

      if (!expoConnectionUrl) {
        // Check if Expo is actually running
        let expoRunning = false;
        try {
          const psProcess = await sandbox.exec(["ps", "aux"]);
          const psOutput = await psProcess.stdout.readText();
          await psProcess.wait();
          expoRunning = psOutput.includes("expo") || (psOutput.includes("node") && psOutput.includes("8081"));
        } catch (error) {
          // Can't check process
        }
        
        // Provide more helpful error message with context
        return NextResponse.json({
          success: false,
          error: expoRunning 
            ? "Failed to get Expo connection URL. Expo tunnel may still be initializing. Try again in a few seconds."
            : "Failed to get Expo connection URL. Expo may not be running or tunnel setup failed.",
          previewUrl,
          expoConnectionUrl: null,
          debug: {
            expoRunning,
            hint: project?.sandboxId ? `Check /api/sandbox-logs?sandboxId=${project.sandboxId} to see Expo logs` : "Check Expo logs in sandbox",
          },
        }, { status: 503 });
      }

      return NextResponse.json({
        success: true,
        previewUrl,
        expoConnectionUrl,
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: "Sandbox exists but is not accessible",
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[expo-connection] Error getting connection info:", error);
    return createErrorResponse(error, 500);
  }
}

