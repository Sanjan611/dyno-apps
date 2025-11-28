"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MoreVertical, PlusCircle } from "lucide-react";

interface Project {
  id: string;
  sandboxId: string;
  name: string;
  description: string;
  lastModified: string;
}

export default function ProjectGalleryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/projects");
        const data = await response.json();

        if (data.success) {
          setProjects(data.projects || []);
        } else {
          setError(data.error || "Failed to load projects");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleDelete = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const confirmed = window.confirm(
      `Delete "${project.name}"? This also terminates its sandbox and cannot be undone.`
    );
    if (!confirmed) {
      setMenuOpenId(null);
      return;
    }

    try {
      setDeletingProjectId(projectId);
      setActionError(null);
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        setActionError(data.error || "Failed to delete project");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeletingProjectId(null);
      setMenuOpenId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Dyno Apps
            </Link>
          </div>
          <Button asChild>
            <Link href="/builder">
              <PlusCircle className="w-4 h-4 mr-2" />
              New Project
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-1">Project Gallery</h2>
          <p className="text-muted-foreground">
            Manage and edit your mobile applications
          </p>
        </div>

        {actionError && (
          <div className="mb-6 rounded-md border border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-destructive">Error: {error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {project.lastModified}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/builder?projectId=${project.id}`}>Open</Link>
                    </Button>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setMenuOpenId((prev) => (prev === project.id ? null : project.id))
                        }
                        aria-haspopup="menu"
                        aria-expanded={menuOpenId === project.id}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                      {menuOpenId === project.id && (
                        <div className="absolute right-0 mt-2 w-36 rounded-md border bg-popover text-sm shadow-md z-20">
                          <button
                            className="w-full px-3 py-2 text-left hover:bg-destructive/10 text-destructive disabled:opacity-50"
                            onClick={() => handleDelete(project.id)}
                            disabled={deletingProjectId === project.id}
                          >
                            {deletingProjectId === project.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))}

            <Card className="border-dashed hover:border-primary hover:bg-accent transition-colors">
              <Link
                href="/builder"
                className="flex flex-col items-center justify-center h-full w-full"
              >
                <CardHeader className="text-center">
                  <PlusCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <CardTitle>Create New Project</CardTitle>
                </CardHeader>
              </Link>
            </Card>
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed rounded-lg">
            <h3 className="text-2xl font-semibold">No Projects Yet</h3>
            <p className="text-muted-foreground mt-2 mb-4">
              Click the button below to start building your first app.
            </p>
            <Button asChild>
              <Link href="/builder">
                <PlusCircle className="w-4 h-4 mr-2" />
                Create New Project
              </Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
