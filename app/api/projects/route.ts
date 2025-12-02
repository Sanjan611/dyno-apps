import { NextRequest, NextResponse } from "next/server";
import {
  addProject,
  formatRelativeTime,
  getAllProjects,
  getProject,
  updateProject,
} from "@/lib/server/projectStore";
import { getAuthenticatedUser } from "@/lib/supabase/server";

// GET /api/projects - Get all projects or a single project by ID
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // If projectId is provided, return single project
    if (projectId) {
      const project = await getProject(projectId, user.id);
      if (!project) {
        return NextResponse.json(
          {
            success: false,
            error: "Project not found",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
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

    return NextResponse.json({
      success: true,
      projects: projectsArray,
    });
  } catch (error) {
    console.error("[projects] Error fetching projects:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project (no sandbox creation)
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

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

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        lastModified: formatRelativeTime(project.updatedAt),
      },
    });
  } catch (error) {
    console.error("[projects] Error creating project:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH /api/projects - Update a project
export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const { projectId, name, title } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: "projectId is required",
        },
        { status: 400 }
      );
    }

    const nextTitle = title ?? name;

    if (!nextTitle || typeof nextTitle !== "string" || nextTitle.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "title is required and must be a non-empty string",
        },
        { status: 400 }
      );
    }

    const updatedProject = await updateProject(projectId, user.id, {
      title: nextTitle.trim(),
    });

    if (!updatedProject) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    console.log("[projects] Updated project:", projectId, "new title:", nextTitle.trim());

    return NextResponse.json({
      success: true,
      project: {
        ...updatedProject,
        lastModified: formatRelativeTime(updatedProject.updatedAt),
      },
    });
  } catch (error) {
    console.error("[projects] Error updating project:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

