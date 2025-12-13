/**
 * Server-side title generation utilities
 * Automatically generates project titles based on user prompts
 */

import { b } from "@/baml_client";
import { getProject, updateProject } from "./projectStore";
import { DEFAULT_PROJECT_NAME } from "../constants";

const LOG_PREFIX = "[title-generator]";

/**
 * Attempts to auto-generate a project title if:
 * 1. The current title is "Untitled" or "Untitled Project" or DEFAULT_PROJECT_NAME
 * 2. The title has not been manually updated by the user
 *
 * This is designed to be non-blocking - if title generation fails,
 * it logs the error but doesn't throw.
 *
 * @param projectId - The project ID
 * @param userId - The user ID
 * @param userPrompt - The user's first message/prompt
 */
export async function autoGenerateProjectTitle(
  projectId: string,
  userId: string,
  userPrompt: string
): Promise<void> {
  try {
    // Fetch the current project to check if we should auto-generate
    const project = await getProject(projectId, userId);

    if (!project) {
      console.error(`${LOG_PREFIX} Project not found: ${projectId}`);
      return;
    }

    // Check if title was manually updated
    if (project.titleManuallyUpdated) {
      console.log(`${LOG_PREFIX} Title was manually updated, skipping auto-generation for project: ${projectId}`);
      return;
    }

    // Check if title is still the default "Untitled" or "Untitled Project"
    const isDefaultTitle =
      project.title === "Untitled" ||
      project.title === "Untitled Project" ||
      project.title === DEFAULT_PROJECT_NAME;

    if (!isDefaultTitle) {
      console.log(`${LOG_PREFIX} Title is not default ('${project.title}'), skipping auto-generation for project: ${projectId}`);
      return;
    }

    // Generate the title using BAML
    console.log(`${LOG_PREFIX} Generating title for project: ${projectId}`);
    const generatedTitle = await b.GenerateProjectTitle(userPrompt);

    if (!generatedTitle || generatedTitle.trim().length === 0) {
      console.warn(`${LOG_PREFIX} Generated title is empty, skipping update for project: ${projectId}`);
      return;
    }

    // Update the project with the new title (but don't mark as manually updated)
    await updateProject(projectId, userId, {
      title: generatedTitle.trim(),
      titleManuallyUpdated: false, // Keep this false since it's auto-generated
    });

    console.log(`${LOG_PREFIX} Successfully updated project ${projectId} with title: "${generatedTitle.trim()}"`);
  } catch (error) {
    // Log error but don't throw - title generation should be non-blocking
    console.error(`${LOG_PREFIX} Error auto-generating title for project ${projectId}:`, error);
  }
}
