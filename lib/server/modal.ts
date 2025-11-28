import { ModalClient, NotFoundError } from "modal";

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
 * Gets the Node.js image for sandboxes
 */
export function getNodeImage(modal: ModalClient) {
  return modal.images.fromRegistry("node:20-slim");
}

/**
 * Creates a new sandbox with the standard configuration
 */
export async function createSandbox(modal: ModalClient) {
  const app = await getOrCreateModalApp(modal);
  const image = getNodeImage(modal);
  
  const sandbox = await modal.sandboxes.create(app, image, {
    unencryptedPorts: [19006],
  });

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

