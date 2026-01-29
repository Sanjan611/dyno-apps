import { NextRequest } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { createModalClient } from "@/lib/server/modal";
import { runCodingAgent, runAskAgent, formatErrorForStream } from "@/lib/server/coding-agent";
import { getProject } from "@/lib/server/projectStore";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { LOG_PREFIXES, ERROR_MESSAGES } from "@/lib/constants";
import type { SSEProgressEvent, MessageMode } from "@/types";
import { autoGenerateProjectTitle } from "@/lib/server/title-generator";
import type { codingAgentTask } from "@/trigger/coding-agent";
import type { askAgentTask } from "@/trigger/ask-agent";
import { getUserCredits } from "@/lib/server/creditsStore";

// Force dynamic route to enable streaming
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Check if Trigger.dev is enabled
  const useTriggerDev = process.env.USE_TRIGGER_DEV === "true";

  // ============================================================================
  // Trigger.dev Path - Returns JSON immediately, frontend uses useRealtimeRun
  // ============================================================================
  if (useTriggerDev) {
    try {
      // Authenticate user
      const user = await getAuthenticatedUser(request);
      if (!user) {
        return Response.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 });
      }

      // Get project ID from params
      const params = await context.params;
      if (!params?.id) {
        return Response.json({ error: "Project ID is required" }, { status: 400 });
      }

      const projectId = params.id;

      // Get and validate project
      const project = await getProject(projectId, user.id);
      if (!project) {
        return Response.json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }, { status: 404 });
      }

      // Check if project has a sandbox
      if (!project.currentSandboxId) {
        return Response.json(
          { error: "Project does not have an active sandbox. Please initialize the sandbox first." },
          { status: 400 }
        );
      }

      // Check user has credits
      const credits = await getUserCredits(user.id);
      if (credits.balance <= 0) {
        return Response.json(
          { error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" },
          { status: 402 }
        );
      }

      const body = await request.json();
      const { userPrompt, mode } = body;
      const messageMode: MessageMode = mode || "build";

      if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
        return Response.json(
          { error: "userPrompt is required and must be a non-empty string" },
          { status: 400 }
        );
      }

      console.log(
        `${LOG_PREFIXES.CHAT} [Trigger.dev] Starting chat for project: ${projectId}, sandbox: ${project.currentSandboxId}`
      );

      // Auto-generate project title if needed
      const generatedTitle = await autoGenerateProjectTitle(projectId, user.id, userPrompt);

      // Trigger the Trigger.dev task based on mode
      const handle = messageMode === 'ask'
        ? await tasks.trigger<typeof askAgentTask>("ask-agent", {
            projectId,
            sandboxId: project.currentSandboxId,
            userPrompt: userPrompt.trim(),
            userId: user.id,
          })
        : await tasks.trigger<typeof codingAgentTask>("coding-agent", {
            projectId,
            sandboxId: project.currentSandboxId,
            userPrompt: userPrompt.trim(),
            userId: user.id,
          });

      console.log(`${LOG_PREFIXES.CHAT} [Trigger.dev] Task triggered with runId: ${handle.id}`);

      // Return immediately with run info for frontend to subscribe via useRealtimeRun
      return Response.json({
        runId: handle.id,
        publicAccessToken: handle.publicAccessToken,
        ...(generatedTitle && { generatedTitle }),
      });
    } catch (error) {
      console.error(`${LOG_PREFIXES.CHAT} [Trigger.dev] Error triggering task:`, error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Failed to start code generation" },
        { status: 500 }
      );
    }
  }

  // ============================================================================
  // SSE Path - Original implementation for gradual rollout
  // ============================================================================

  // Create SSE stream infrastructure
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  let isStreamClosed = false;

  // Helper function to safely close the writer
  const closeWriter = async () => {
    if (isStreamClosed) return;
    try {
      isStreamClosed = true;
      await writer.close();
    } catch (error) {
      // Stream may already be closed, ignore the error
      if (error instanceof Error && error.message.includes('closed')) {
        // Expected when client aborts
        return;
      }
      console.error(`${LOG_PREFIXES.CHAT} Error closing writer:`, error);
    }
  };

  // Helper function to send progress updates
  const sendProgress = async (event: SSEProgressEvent) => {
    // Don't try to write if stream is closed or request is aborted
    if (isStreamClosed || request.signal.aborted) {
      return;
    }
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch (error) {
      // If stream is closed (e.g., client aborted), mark as closed and ignore
      if (error instanceof Error && (
        error.message.includes('closed') || 
        error.message.includes('aborted') ||
        error.name === 'ResponseAborted'
      )) {
        isStreamClosed = true;
        return;
      }
      console.error(`${LOG_PREFIXES.CHAT} Error writing to stream:`, error);
    }
  };

  // Helper function to send keepalive comment (resets timeout without being parsed as data)
  const sendKeepalive = async () => {
    // Don't try to write if stream is closed or request is aborted
    if (isStreamClosed || request.signal.aborted) {
      return;
    }
    try {
      await writer.write(encoder.encode(': keepalive\n\n'));
    } catch (error) {
      // If stream is closed, mark as closed and ignore
      if (error instanceof Error && (
        error.message.includes('closed') || 
        error.message.includes('aborted') ||
        error.name === 'ResponseAborted'
      )) {
        isStreamClosed = true;
        return;
      }
      // Ignore other errors on keepalive
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
        await closeWriter();
        return;
      }

      // Get project ID from params
      const params = await context.params;
      if (!params || !params.id) {
        const errorEvent = formatErrorForStream(new Error("Project ID is required"));
        await sendProgress(errorEvent);
        await closeWriter();
        return;
      }

      const projectId = params.id;
      
      // Get and validate project
      const project = await getProject(projectId, user.id);
      
      if (!project) {
        const errorEvent = formatErrorForStream(new Error(ERROR_MESSAGES.PROJECT_NOT_FOUND));
        await sendProgress(errorEvent);
        await closeWriter();
        return;
      }

      // Check if project has a sandbox
      if (!project.currentSandboxId) {
        const errorEvent = formatErrorForStream(new Error("Project does not have an active sandbox. Please initialize the sandbox first."));
        await sendProgress(errorEvent);
        await closeWriter();
        return;
      }

      // Check user has credits
      const credits = await getUserCredits(user.id);
      if (credits.balance <= 0) {
        await sendProgress({
          type: "error",
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS",
        });
        await closeWriter();
        return;
      }

      const body = await request.json();
      const { userPrompt, mode } = body;
      const messageMode: MessageMode = mode || 'build'; // Default to build for backward compatibility

      if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
        const errorEvent = formatErrorForStream(new Error("userPrompt is required and must be a non-empty string"));
        await sendProgress(errorEvent);
        await closeWriter();
        return;
      }

      console.log(`${LOG_PREFIXES.CHAT} Starting chat for project: ${projectId}, sandbox: ${project.currentSandboxId}, mode: ${messageMode}`);

      // Auto-generate project title if needed and stream update to frontend
      const generatedTitle = await autoGenerateProjectTitle(projectId, user.id, userPrompt);
      if (generatedTitle) {
        // Send title update event to frontend
        await sendProgress({
          type: 'title_updated',
          title: generatedTitle,
        });
      }

      // Initialize Modal client
      const modal = createModalClient();

      // Start keepalive interval during long operations
      const keepaliveInterval = setInterval(() => {
        sendKeepalive();
      }, 15000); // Send keepalive every 15 seconds

      try {
        // Choose agent based on mode
        // State is automatically loaded from storage and saved after completion
        // Pass the request's abort signal to allow cancellation
        const result = messageMode === 'ask'
          ? await runAskAgent(modal, {
              userPrompt: userPrompt.trim(),
              sandboxId: project.currentSandboxId,
              projectId: projectId,
              userId: user.id,
              onProgress: sendProgress,
              signal: request.signal,
            })
          : await runCodingAgent(modal, {
              userPrompt: userPrompt.trim(),
              sandboxId: project.currentSandboxId,
              projectId: projectId,
              userId: user.id,
              onProgress: sendProgress,
              signal: request.signal,
            });

        // If there was an error, it was already sent via onProgress
        if (!result.success && result.error) {
          // Error already reported via onProgress callback
          console.error(`${LOG_PREFIXES.CHAT} Chat failed:`, result.error);
        }
        
        // Note: If request was aborted, runCodingAgent already handled it
        // by checking signal.aborted and sending a 'stopped' event
      } finally {
        clearInterval(keepaliveInterval);
        await closeWriter();
      }
    } catch (error) {
      console.error(`${LOG_PREFIXES.CHAT} Error in chat:`, error);
      const errorEvent = formatErrorForStream(error);
      await sendProgress(errorEvent);
      await closeWriter();
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

