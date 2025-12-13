import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectInsert, ProjectUpdate } from "@/types";

// Re-export types for backwards compatibility
export type { Project, ProjectInsert, ProjectUpdate };

function mapProject(row: any): Project {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    repositoryUrl: row.repository_url ?? null,
    currentSandboxId: row.current_sandbox_id ?? null,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    titleManuallyUpdated: row.title_manually_updated ?? false,
  };
}

export async function addProject(project: ProjectInsert): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      title: project.title,
      description: project.description,
      repository_url: project.repositoryUrl,
      current_sandbox_id: project.currentSandboxId,
      user_id: project.userId,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapProject(data);
}

export async function getProject(projectId: string, userId: string, retries: number = 3): Promise<Project | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Project not found - if this is a new project, retry a few times in case of race condition
      if (retries > 0) {
        console.log(`[projectStore] Project not found, retrying... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
        return getProject(projectId, userId, retries - 1);
      }
      return null;
    }
    console.error("[projectStore] Error fetching project:", projectId, "error:", error);
    throw error;
  }

  if (!data) {
    // Data is null - retry if we have retries left
    if (retries > 0) {
      console.log(`[projectStore] No data returned, retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      return getProject(projectId, userId, retries - 1);
    }
    return null;
  }

  try {
    return mapProject(data);
  } catch (mapError) {
    console.error("[projectStore] Error mapping project:", projectId, "error:", mapError);
    throw mapError;
  }
}

export async function deleteProject(projectId: string, userId: string): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data ? mapProject(data) : null;
}

export async function updateProject(
  projectId: string,
  userId: string,
  updates: ProjectUpdate
): Promise<Project | null> {
  const supabase = await createClient();
  const updatePayload: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    updatePayload.title = updates.title;
  }
  if (updates.description !== undefined) {
    updatePayload.description = updates.description;
  }
  if (updates.repositoryUrl !== undefined) {
    updatePayload.repository_url = updates.repositoryUrl;
  }
  if (updates.currentSandboxId !== undefined) {
    updatePayload.current_sandbox_id = updates.currentSandboxId;
  }
  if (updates.titleManuallyUpdated !== undefined) {
    updatePayload.title_manually_updated = updates.titleManuallyUpdated;
  }

  if (Object.keys(updatePayload).length === 0) {
    return getProject(projectId, userId);
  }

  const { data, error } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data ? mapProject(data) : null;
}

export async function getAllProjects(userId: string): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapProject);
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

/**
 * Updates a project's sandboxId
 */
export function updateProjectSandboxId(
  projectId: string,
  userId: string,
  sandboxId: string | null
) {
  return updateProject(projectId, userId, { currentSandboxId: sandboxId });
}

