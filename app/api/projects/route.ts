import { NextRequest, NextResponse } from "next/server";

interface Project {
  id: string;
  sandboxId: string;
  name: string;
  description: string;
  createdAt: string;
  lastModified: string;
}

// In-memory storage for projects
// Note: This will be lost on server restart
const projects = new Map<string, Project>();

// Helper function to generate project ID
function generateProjectId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Helper function to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  return date.toLocaleDateString();
}

// GET /api/projects - Get all projects or a single project by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // If projectId is provided, return single project
    if (projectId) {
      const project = projects.get(projectId);
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
    const projectsArray = Array.from(projects.values())
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

    projects.set(projectId, project);

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

