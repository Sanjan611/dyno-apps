import { NextRequest } from "next/server";
import { runs } from "@trigger.dev/sdk/v3";
import { getProject } from "@/lib/server/projectStore";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { ERROR_MESSAGES, LOG_PREFIXES } from "@/lib/constants";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    // Verify user owns this project
    const project = await getProject(projectId, user.id);
    if (!project) {
      return Response.json({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND }, { status: 404 });
    }

    // Get runId from request body
    const body = await request.json();
    const { runId } = body;

    if (!runId || typeof runId !== "string") {
      return Response.json(
        { error: "runId is required and must be a string" },
        { status: 400 }
      );
    }

    console.log(
      `${LOG_PREFIXES.CHAT} Cancelling Trigger.dev run: ${runId} for project: ${projectId}`
    );

    // Cancel the Trigger.dev run
    await runs.cancel(runId);

    console.log(`${LOG_PREFIXES.CHAT} Successfully cancelled run: ${runId}`);

    return Response.json({ success: true });
  } catch (error) {
    console.error(`${LOG_PREFIXES.CHAT} Error cancelling run:`, error);

    // Handle specific Trigger.dev errors
    if (error instanceof Error) {
      // Run may already be completed or cancelled
      if (error.message.includes("not found") || error.message.includes("already")) {
        return Response.json(
          { error: "Run not found or already completed" },
          { status: 404 }
        );
      }
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to cancel run" },
      { status: 500 }
    );
  }
}
