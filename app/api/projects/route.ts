import { NextRequest } from "next/server";
import {
  addProject,
  deleteProject,
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
import { createProjectRepo } from "@/lib/server/github";
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

    // Create corresponding GitHub repository for this project
    const githubResult = await createProjectRepo({ projectId: project.id });

    if (!githubResult.ok) {
      console.error(
        "[projects] Error creating GitHub repo for project:",
        project.id,
        "status:",
        githubResult.status,
        "message:",
        githubResult.message
      );

      // Roll back project creation if GitHub repo creation fails
      try {
        await deleteProject(project.id, user.id);
        console.log(
          "[projects] Rolled back project",
          project.id,
          "after GitHub repo creation failure"
        );
      } catch (rollbackError) {
        console.error(
          "[projects] Failed to roll back project after GitHub error:",
          project.id,
          rollbackError
        );
      }

      return internalErrorResponse(
        new Error(
          githubResult.message ||
            "Failed to create backing GitHub repository for project"
        )
      );
    }

    // GitHub repo created successfully - update project with repository URL
    console.log("[projects] GitHub repo created successfully:", githubResult.message);
    
    if (!githubResult.repositoryUrl) {
      console.warn("[projects] GitHub repo created but repositoryUrl is missing");
      // Continue without repository URL - this shouldn't happen but handle gracefully
      return successResponse({
        project: {
          ...project,
          lastModified: formatRelativeTime(project.updatedAt),
        },
      });
    }

    const updatedProject = await updateProject(project.id, user.id, {
      repositoryUrl: githubResult.repositoryUrl,
    });
    
    if (!updatedProject) {
      console.error("[projects] Failed to update project with repository URL");
      // Return project without URL rather than failing completely
      return successResponse({
        project: {
          ...project,
          lastModified: formatRelativeTime(project.updatedAt),
        },
      });
    }

    console.log("[projects] Updated project with repository URL:", githubResult.repositoryUrl);
    return successResponse({
      project: {
        ...updatedProject,
        lastModified: formatRelativeTime(updatedProject.updatedAt),
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

