import { NextRequest } from "next/server";
import {
  addProject,
  formatRelativeTime,
  getAllProjects,
  getProject,
  updateProject,
} from "@/lib/server/projectStore";
import {
  withAuth,
  successResponse,
  notFoundResponse,
  badRequestResponse,
  internalErrorResponse,
} from "@/lib/server/api-utils";
import type { GetProjectsResponse, GetProjectResponse } from "@/types/api";

// GET /api/projects - Get all projects or a single project by ID
export const GET = withAuth<GetProjectsResponse | GetProjectResponse>(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // If projectId is provided, return single project
    if (projectId) {
      const project = await getProject(projectId, user.id);
      if (!project) {
        return notFoundResponse("Project not found");
      }

      return successResponse({
        project: {
          ...project,
          lastModified: formatRelativeTime(project.updatedAt),
        },
      });
    }

    // Otherwise, return all projects
    const projectsArray = (await getAllProjects(user.id)).map((project) => ({
      ...project,
      lastModified: formatRelativeTime(project.updatedAt),
    }));

    return successResponse({
      projects: projectsArray,
    });
  } catch (error) {
    console.error("[projects] Error fetching projects:", error);
    return internalErrorResponse(error);
  }
});

// POST /api/projects - Create a new project (no sandbox creation)
export const POST = withAuth(async (request, user) => {
  try {
    const { name, title, description, firstMessage, repositoryUrl } = await request.json();

    // Extract project name from first message or use default
    const projectTitle =
      title ||
      name ||
      (firstMessage ? firstMessage.substring(0, 50) : "Untitled Project");
    const projectDescription = description || firstMessage || "No description";

    const project = await addProject({
      title: projectTitle,
      description: projectDescription,
      repositoryUrl: repositoryUrl ?? null,
      currentSandboxId: null,
      userId: user.id,
    });

    console.log("[projects] Created project:", project.id, "(sandbox will be created when opened)");

    return successResponse({
      project: {
        ...project,
        lastModified: formatRelativeTime(project.updatedAt),
      },
    });
  } catch (error) {
    console.error("[projects] Error creating project:", error);
    return internalErrorResponse(error);
  }
});

// PATCH /api/projects - Update a project
export const PATCH = withAuth(async (request, user) => {
  try {
    const { projectId, name, title } = await request.json();

    if (!projectId) {
      return badRequestResponse("projectId is required");
    }

    const nextTitle = title ?? name;

    if (!nextTitle || typeof nextTitle !== "string" || nextTitle.trim().length === 0) {
      return badRequestResponse("title is required and must be a non-empty string");
    }

    const updatedProject = await updateProject(projectId, user.id, {
      title: nextTitle.trim(),
    });

    if (!updatedProject) {
      return notFoundResponse("Project not found");
    }

    console.log("[projects] Updated project:", projectId, "new title:", nextTitle.trim());

    return successResponse({
      project: {
        ...updatedProject,
        lastModified: formatRelativeTime(updatedProject.updatedAt),
      },
    });
  } catch (error) {
    console.error("[projects] Error updating project:", error);
    return internalErrorResponse(error);
  }
});

