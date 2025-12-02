import { NextRequest, NextResponse } from "next/server";
import {
  addProject,
  formatRelativeTime,
  generateProjectId,
  getAllProjects,
  getProject,
  updateProject,
  type Project,
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
      const project = getProject(projectId);
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
          lastModified: formatRelativeTime(project.lastModified),
        },
      });
    }

    // Otherwise, return all projects
    const projectsArray = getAllProjects()
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      .map((project) => ({
        ...project,
        lastModified: formatRelativeTime(project.lastModified),
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
    const { name, description, firstMessage } = await request.json();

    // Extract project name from first message or use default
    const projectName = name || (firstMessage ? firstMessage.substring(0, 50) : "Untitled Project");
    const projectDescription = description || firstMessage || "No description";

    const now = new Date().toISOString();
    const projectId = generateProjectId();

    const project: Project = {
      id: projectId,
      sandboxId: null, // Sandbox will be created when project is opened
      name: projectName,
      description: projectDescription,
      createdAt: now,
      lastModified: now,
    };

    addProject(project);

    console.log("[projects] Created project:", projectId, "(sandbox will be created when opened)");

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        lastModified: formatRelativeTime(project.lastModified),
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
    const { projectId, name } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: "projectId is required",
        },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "name is required and must be a non-empty string",
        },
        { status: 400 }
      );
    }

    const updatedProject = updateProject(projectId, { name: name.trim() });

    if (!updatedProject) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
        },
        { status: 404 }
      );
    }

    console.log("[projects] Updated project:", projectId, "new name:", name.trim());

    return NextResponse.json({
      success: true,
      project: {
        ...updatedProject,
        lastModified: formatRelativeTime(updatedProject.lastModified),
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

