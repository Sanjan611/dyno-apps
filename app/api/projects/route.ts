import { NextRequest, NextResponse } from "next/server";
import {
  addProject,
  formatRelativeTime,
  generateProjectId,
  getAllProjects,
  getProject,
  type Project,
} from "@/lib/server/projectStore";

// GET /api/projects - Get all projects or a single project by ID
export async function GET(request: NextRequest) {
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

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const { sandboxId, name, description, firstMessage } = await request.json();

    if (!sandboxId) {
      return NextResponse.json(
        {
          success: false,
          error: "sandboxId is required",
        },
        { status: 400 }
      );
    }

    // Extract project name from first message or use default
    const projectName = name || (firstMessage ? firstMessage.substring(0, 50) : "Untitled Project");
    const projectDescription = description || firstMessage || "No description";

    const now = new Date().toISOString();
    const projectId = generateProjectId();

    const project: Project = {
      id: projectId,
      sandboxId,
      name: projectName,
      description: projectDescription,
      createdAt: now,
      lastModified: now,
    };

    addProject(project);

    console.log("[projects] Created project:", projectId, "for sandbox:", sandboxId);

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

