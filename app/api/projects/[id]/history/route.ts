import { NextRequest } from "next/server";
import { getProject } from "@/lib/server/projectStore";
import {
  withAsyncParams,
  successResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/server/api-utils";
import { LOG_PREFIXES } from "@/lib/constants";
import { getConversationHistory } from "@/lib/server/conversation-history-store";

/**
 * GET /api/projects/[id]/history - Get conversation history for a project
 *
 * Returns the saved conversation messages for the project.
 * Returns empty array if no history exists (new project).
 */
export const GET = withAsyncParams(async (request, user, params) => {
  try {
    if (!params || !params.id) {
      return notFoundResponse("Project ID is required");
    }
    const projectId = typeof params.id === "string" ? params.id : await params.id;
    console.log(
      `${LOG_PREFIXES.PROJECTS} History request for project:`,
      projectId,
      "user:",
      user.id
    );

    // Verify project exists and user has access
    const project = await getProject(projectId, user.id);

    if (!project) {
      console.log(
        `${LOG_PREFIXES.PROJECTS} Project not found for history:`,
        projectId
      );
      return notFoundResponse("Project not found");
    }

    // Fetch conversation history
    const messages = await getConversationHistory(projectId);

    console.log(
      `${LOG_PREFIXES.PROJECTS} Returning ${messages?.length ?? 0} messages for project:`,
      projectId
    );

    return successResponse({
      messages: messages ?? [],
    });
  } catch (error) {
    console.error(`${LOG_PREFIXES.PROJECTS} Error fetching history:`, error);
    return internalErrorResponse(error);
  }
});
