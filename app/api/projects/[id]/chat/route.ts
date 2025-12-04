import { NextRequest } from "next/server";
import { createModalClient } from "@/lib/server/modal";
import { runCodingAgent, formatErrorForStream } from "@/lib/server/coding-agent";
import { getProject } from "@/lib/server/projectStore";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { LOG_PREFIXES, ERROR_MESSAGES } from "@/lib/constants";
import type { SSEProgressEvent } from "@/types";

// Force dynamic route to enable streaming
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Create SSE stream infrastructure
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper function to send progress updates
  const sendProgress = async (event: SSEProgressEvent) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch (error) {
      console.error(`${LOG_PREFIXES.CHAT} Error writing to stream:`, error);
    }
  };

  // Helper function to send keepalive comment (resets timeout without being parsed as data)
  const sendKeepalive = async () => {
    try {
      await writer.write(encoder.encode(': keepalive\n\n'));
    } catch (error) {
      // Ignore errors on keepalive
    }
  };

  // Start processing in background
  (async () => {
    try {
      // Authenticate user
      const user = await getAuthenticatedUser(request);
      if (!user) {
        const errorEvent = formatErrorForStream(new Error(ERROR_MESSAGES.UNAUTHORIZED));
        await sendProgress(errorEvent);
        await writer.close();
        return;
      }

      // Get project ID from params
      const params = await context.params;
      if (!params || !params.id) {
        const errorEvent = formatErrorForStream(new Error("Project ID is required"));
        await sendProgress(errorEvent);
        await writer.close();
        return;
      }

      const projectId = params.id;
      
      // Get and validate project
      const project = await getProject(projectId, user.id);
      
      if (!project) {
        const errorEvent = formatErrorForStream(new Error(ERROR_MESSAGES.PROJECT_NOT_FOUND));
        await sendProgress(errorEvent);
        await writer.close();
        return;
      }

      // Check if project has a sandbox
      if (!project.currentSandboxId) {
        const errorEvent = formatErrorForStream(new Error("Project does not have an active sandbox. Please initialize the sandbox first."));
        await sendProgress(errorEvent);
        await writer.close();
        return;
      }

      const { userPrompt } = await request.json();
      
      if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
        const errorEvent = formatErrorForStream(new Error("userPrompt is required and must be a non-empty string"));
        await sendProgress(errorEvent);
        await writer.close();
        return;
      }

      console.log(`${LOG_PREFIXES.CHAT} Starting chat for project: ${projectId}, sandbox: ${project.currentSandboxId}`);

      // Initialize Modal client
      const modal = createModalClient();

      // Start keepalive interval during long operations
      const keepaliveInterval = setInterval(() => {
        sendKeepalive();
      }, 15000); // Send keepalive every 15 seconds

      try {
        // Run the coding agent orchestration
        const result = await runCodingAgent(modal, {
          userPrompt: userPrompt.trim(),
          sandboxId: project.currentSandboxId,
          onProgress: sendProgress,
        });

        // If there was an error, it was already sent via onProgress
        if (!result.success && result.error) {
          // Error already reported via onProgress callback
          console.error(`${LOG_PREFIXES.CHAT} Chat failed:`, result.error);
        }
      } finally {
        clearInterval(keepaliveInterval);
        await writer.close();
      }
    } catch (error) {
      console.error(`${LOG_PREFIXES.CHAT} Error in chat:`, error);
      const errorEvent = formatErrorForStream(error);
      await sendProgress(errorEvent);
      await writer.close();
    }
  })();

  // Return the stream with proper headers for SSE
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

