import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";
import { readFile } from "fs/promises";
import { join } from "path";
import { EXPO_PORT, TIMEOUTS, REPO_DIR } from "@/lib/constants";

/**
 * Builds an authenticated git clone URL by embedding the PAT
 * @param repositoryUrl - The repository URL (e.g., https://github.com/org/repo)
 * @param pat - GitHub Personal Access Token
 * @returns Authenticated clone URL (e.g., https://PAT@github.com/org/repo.git)
 */
function buildAuthenticatedCloneUrl(repositoryUrl: string, pat: string): string {
  // Ensure URL ends with .git
  const cloneUrl = repositoryUrl.endsWith(".git") ? repositoryUrl : `${repositoryUrl}.git`;
  // Embed PAT in URL: https://github.com -> https://PAT@github.com
  return cloneUrl.replace(/^https:\/\//, `https://${pat}@`);
}

/**
 * Clones a git repository in the sandbox
 * @param sandbox - Modal sandbox instance
 * @param authenticatedUrl - Git clone URL with authentication
 * @param destination - Destination directory path
 * @returns Success status and error message if failed
 */
async function cloneRepository(
  sandbox: any,
  authenticatedUrl: string,
  destination: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create /repo directory first if it doesn't exist
    // This is needed because workdir requires the directory to exist
    const mkdirProcess = await sandbox.exec(["mkdir", "-p", REPO_DIR]);
    await mkdirProcess.wait();
    
    const cloneProcess = await sandbox.exec(
      ["git", "clone", authenticatedUrl, destination],
      {
        stdout: "pipe",
        stderr: "pipe",
        workdir: REPO_DIR,
      }
    );

    // Read stdout and stderr before waiting
    const stdoutPromise = cloneProcess.stdout.readText().catch(() => "");
    const stderrPromise = cloneProcess.stderr.readText().catch(() => "");

    const exitCode = await cloneProcess.wait();
    const stdout = await stdoutPromise;
    const stderr = await stderrPromise;

    if (exitCode !== 0) {
      console.error("[init-expo] Git clone failed. Exit code:", exitCode);
      console.error("[init-expo] Git clone stderr:", stderr);
      console.error("[init-expo] Git clone stdout:", stdout);
      const errorMessage = stderr || stdout || "Unknown error";
      return {
        success: false,
        error: `Failed to clone repository: ${errorMessage.substring(0, 200)}`,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[init-expo] Exception during git clone:", errorMessage);
    return {
      success: false,
      error: `Failed to clone repository: ${errorMessage}`,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sandboxId, skipInit, repositoryUrl, projectId } = await request.json();
    console.log("[init-expo] Starting Expo initialization for sandbox:", sandboxId, "skipInit:", skipInit, "repositoryUrl:", repositoryUrl, "projectId:", projectId);

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

    // Check if repository has already been cloned by checking if /repo/package.json exists
    let repoExists = false;
    try {
      const packageJsonFile = await sandbox.open(`${REPO_DIR}/package.json`, "r");
      await packageJsonFile.close();
      repoExists = true;
      console.log("[init-expo] Repository already cloned at", REPO_DIR);
    } catch (error) {
      repoExists = false;
      console.log("[init-expo] Repository not found at", REPO_DIR, "will clone if repositoryUrl is provided");
    }

    // If repositoryUrl is provided and repo doesn't exist, clone it
    if (repositoryUrl && !repoExists) {
      console.log("[init-expo] Cloning repository:", repositoryUrl, "to", REPO_DIR);
      
      const GITHUB_PAT = process.env.GITHUB_PAT;
      if (!GITHUB_PAT) {
        console.error("[init-expo] GITHUB_PAT not set, cannot clone private repository");
        return NextResponse.json(
          {
            success: false,
            error: "GitHub PAT not configured for repository cloning",
          },
          { status: 500 }
        );
      }

      // Construct authenticated clone URL
      const authenticatedUrl = buildAuthenticatedCloneUrl(repositoryUrl, GITHUB_PAT);

      try {
        console.log("[init-expo] Executing git clone to", REPO_DIR);
        
        const cloneResult = await cloneRepository(sandbox, authenticatedUrl, REPO_DIR);
        
        if (!cloneResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: cloneResult.error,
            },
            { status: 500 }
          );
        }

        console.log("[init-expo] Repository cloned successfully to", REPO_DIR);
      } catch (error) {
        console.error("[init-expo] Error during git clone:", error);
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to clone repository",
          },
          { status: 500 }
        );
      }
    }

    // Determine if we should skip init by checking if package.json exists in repo
    let shouldSkipInit = skipInit;
    if (shouldSkipInit === undefined) {
      try {
        const packageJsonFile = await sandbox.open(`${REPO_DIR}/package.json`, "r");
        await packageJsonFile.close();
        shouldSkipInit = true;
        console.log("[init-expo] Found existing package.json at", REPO_DIR, ", will skip Expo initialization");
      } catch (error) {
        shouldSkipInit = false;
        console.log("[init-expo] No existing package.json found at", REPO_DIR, ", will initialize Expo");
      }
    }

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
    // Note: Using absolute path /startup.sh, but setting workdir for consistency
    console.log("[init-expo] Making script executable...");
    const chmodProcess = await sandbox.exec(["chmod", "+x", "/startup.sh"], { workdir: REPO_DIR });
    await chmodProcess.wait();
    console.log("[init-expo] Script is now executable");

    // Execute the startup script with appropriate flag
    // Note: EXPO_TUNNEL_SUBDOMAIN is set as a sandbox environment variable at creation time
    // Note: Using absolute path /startup.sh, but setting workdir for consistency
    const initFlag = shouldSkipInit ? "--skip-init" : "--init";
    console.log("[init-expo] Executing startup script with flag:", initFlag);
    const execProcess = await sandbox.exec(["/bin/bash", "/startup.sh", initFlag], {
      stdout: "pipe",
      stderr: "pipe",
      workdir: REPO_DIR,
    });

    // Stream stdout and stderr to console (for debugging)
    execProcess.stdout.readText().then((stdout) => {
      if (stdout) console.log("[startup.sh stdout]\n", stdout);
    });
    execProcess.stderr.readText().then((stderr) => {
      if (stderr) console.error("[startup.sh stderr]\n", stderr);
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

