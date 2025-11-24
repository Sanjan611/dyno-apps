export interface Project {
  id: string;
  sandboxId: string;
  name: string;
  description: string;
  createdAt: string;
  lastModified: string;
}

const projects = new Map<string, Project>();

export function generateProjectId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function addProject(project: Project): void {
  projects.set(project.id, project);
}

export function getProject(projectId: string): Project | undefined {
  return projects.get(projectId);
}

export function deleteProject(projectId: string): Project | undefined {
  const project = projects.get(projectId);
  if (project) {
    projects.delete(projectId);
  }
  return project;
}

export function getAllProjects(): Project[] {
  return Array.from(projects.values());
}

export function formatRelativeTime(dateString: string): string {
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

