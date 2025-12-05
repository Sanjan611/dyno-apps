import { ModalClient, NotFoundError, Volume } from "modal";
import { EXPO_PORT, WORKING_DIR } from "@/lib/constants";

/**
 * Creates and returns a configured Modal client instance
 */
export function createModalClient(): ModalClient {
  const tokenId = process.env.MODAL_TOKEN_ID;
  const tokenSecret = process.env.MODAL_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error(
      "Modal credentials not configured. Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET in environment variables."
    );
  }

  return new ModalClient({
    tokenId,
    tokenSecret,
  });
}

/**
 * Gets or creates the Modal app for dyno-apps
 */
export async function getOrCreateModalApp(modal: ModalClient) {
  return await modal.apps.fromName("dyno-apps", {
    createIfMissing: true,
  });
}

/**
 * Gets or creates the Node.js image with Bun, Expo CLI, linting tools, and git pre-installed
 * This image is cached and reused across all sandboxes
 * 
 * Note: Node.js is still required alongside Bun because Expo's `bun create expo`
 * and `bun expo prebuild` commands use `npm pack` internally.
 */
export async function getNodeImage(modal: ModalClient) {
  const baseImage = modal.images.fromRegistry("node:20-slim");
  
  // Extend the base image with Bun, Expo CLI, linting tools, and git installation
  // This creates a new image layer that will be cached and reused
  return baseImage.dockerfileCommands([
    "RUN apt-get update && apt-get install -y git curl unzip && rm -rf /var/lib/apt/lists/*",
    "RUN curl -fsSL https://bun.sh/install | bash",
    "ENV PATH=\"/root/.bun/bin:$PATH\"",
    "RUN bun install -g @expo/cli",
    // Use npm for @expo/ngrok since Expo looks in npm's global directory, not bun's
    "RUN npm install -g @expo/ngrok@^4.1.0",
    // Pre-install linting tools globally to save ~16s per sandbox startup
    "RUN bun install -g eslint @eslint/js prettier eslint-config-prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-native"
  ]);
}

/**
 * Gets or creates a Modal Volume for a project
 * @param modal - Modal client instance
 * @param volumeName - Name of the volume (e.g., "dyno-project-{projectId}")
 * @returns Promise that resolves to the Volume
 */
export async function getOrCreateProjectVolume(
  modal: ModalClient,
  volumeName: string
): Promise<Volume> {
  return await modal.volumes.fromName(volumeName, {
    createIfMissing: true,
  });
}

/**
 * Creates a new sandbox with the standard configuration
 * @param modal - Modal client instance
 * @param volume - Optional Volume to mount at WORKING_DIR (/my-app)
 * @param env - Optional environment variables to set in the sandbox
 */
export async function createSandbox(
  modal: ModalClient,
  volume?: Volume,
  env?: Record<string, string>
) {
  const app = await getOrCreateModalApp(modal);
  const image = await getNodeImage(modal);
  
  const sandboxOptions: {
    unencryptedPorts: number[];
    volumes?: Record<string, Volume>;
    env?: Record<string, string>;
  } = {
    unencryptedPorts: [EXPO_PORT],
  };

  // Mount volume at /my-app if provided
  if (volume) {
    sandboxOptions.volumes = {
      [WORKING_DIR]: volume,
    };
  }

  // Set environment variables if provided
  if (env) {
    sandboxOptions.env = env;
  }
  
  const sandbox = await modal.sandboxes.create(app, image, sandboxOptions);

  return {
    sandbox,
    app,
  };
}

/**
 * Standard error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  status: number = 500,
  includeDetails: boolean = false
): Response {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const errorDetails = error instanceof Error ? error.stack : undefined;

  const response: ApiErrorResponse = {
    success: false,
    error: errorMessage,
    ...(includeDetails && errorDetails ? { details: errorDetails } : {}),
  };

  return Response.json(response, { status });
}

/**
 * Checks if a sandbox exists
 */
export async function checkSandboxExists(
  modal: ModalClient,
  sandboxId: string
): Promise<boolean> {
  try {
    await modal.sandboxes.fromId(sandboxId);
    return true;
  } catch (error) {
    if (error instanceof NotFoundError) {
      return false;
    }
    throw error;
  }
}

/**
 * Deletes a Modal Volume for a project
 * @param modal - Modal client instance
 * @param volumeName - Name of the volume (e.g., "dyno-project-{projectId}")
 * @returns Object with deletion status and error information
 */
export async function deleteProjectVolume(
  modal: ModalClient,
  volumeName: string
): Promise<{
  deleted: boolean;
  alreadyMissing: boolean;
}> {
  try {
    // Delete using the volumes collection with the volume name
    await modal.volumes.delete(volumeName);
    console.log("[modal] Deleted volume:", volumeName);
    return {
      deleted: true,
      alreadyMissing: false,
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.log("[modal] Volume already missing:", volumeName);
      return {
        deleted: false,
        alreadyMissing: true,
      };
    }
    // Re-throw other errors so they can be handled by the caller
    throw error;
  }
}

