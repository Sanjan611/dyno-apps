import { NextRequest, NextResponse } from "next/server";
import { createModalClient } from "@/lib/server/modal";
import { runCodingAgent, formatErrorForStream } from "@/lib/server/coding-agent";
import type { SSEProgressEvent } from "@/types";

// Force dynamic route to enable streaming
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Create SSE stream infrastructure
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper function to send progress updates
  const sendProgress = async (event: SSEProgressEvent) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch (error) {
      console.error("[generate-code-stream] Error writing to stream:", error);
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
      const { userPrompt, sandboxId } = await request.json();
      console.log("[generate-code-stream] Starting code generation for sandbox:", sandboxId);

      // Initialize Modal client
      const modal = createModalClient();

      // Start keepalive interval during long operations
      const keepaliveInterval = setInterval(() => {
        sendKeepalive();
      }, 15000); // Send keepalive every 15 seconds

      try {
        // Run the coding agent orchestration
        const result = await runCodingAgent(modal, {
          userPrompt,
          sandboxId,
          onProgress: sendProgress,
        });

        // If there was an error, it was already sent via onProgress
        if (!result.success && result.error) {
          // Error already reported via onProgress callback
          console.error("[generate-code-stream] Code generation failed:", result.error);
        }
      } finally {
        clearInterval(keepaliveInterval);
        await writer.close();
      }
    } catch (error) {
      console.error("[generate-code-stream] Error generating code:", error);
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

