/**
 * Feedback API endpoint
 *
 * Handles user feedback submissions and sends them via email
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  successResponse,
  badRequestResponse,
  errorResponse,
} from "@/lib/server/api-utils";
import { sendFeedbackEmail } from "@/lib/server/email";

const VALID_FEEDBACK_TYPES = ["bug", "feature", "general"] as const;
type FeedbackType = (typeof VALID_FEEDBACK_TYPES)[number];

function isValidFeedbackType(type: string): type is FeedbackType {
  return VALID_FEEDBACK_TYPES.includes(type as FeedbackType);
}

export const POST = withAuth(async (request: NextRequest, user) => {
  const body = await request.json();

  const { email, type, message } = body;

  // Validate message
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return badRequestResponse("Message is required");
  }

  // Validate type
  if (!type || !isValidFeedbackType(type)) {
    return badRequestResponse(
      "Invalid feedback type. Must be one of: bug, feature, general"
    );
  }

  // Use provided email or fall back to user's email
  const feedbackEmail =
    email && typeof email === "string" && email.trim().length > 0
      ? email.trim()
      : user.email;

  if (!feedbackEmail) {
    return badRequestResponse("Email is required");
  }

  const result = await sendFeedbackEmail({
    email: feedbackEmail,
    type,
    message: message.trim(),
    userId: user.id,
  });

  if (!result.success) {
    return errorResponse(result.error || "Failed to send feedback", 500);
  }

  return successResponse({ message: "Feedback sent successfully" });
});
