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
import { MoreVertical, PlusCircle, Search, LayoutGrid, List as ListIcon, Trash2, ExternalLink, Clock, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Project {
  id: string;
  currentSandboxId: string | null;
  title: string;
  description: string | null;
  repositoryUrl: string | null;
  lastModified: string;
}

export default function ProjectGalleryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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
          setFilteredProjects(data.projects || []);
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

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProjects(projects);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      setFilteredProjects(
        projects.filter(
          (p) =>
            p.title.toLowerCase().includes(lowerQuery) ||
            p.description?.toLowerCase().includes(lowerQuery)
        )
      );
    }
  }, [searchQuery, projects]);

  const handleDelete = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const confirmed = window.confirm(
      `Delete "${project.title}"? This also terminates its sandbox and cannot be undone.`
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-white/60 backdrop-blur-xl sticky top-0 z-20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shadow-md group-hover:scale-105 transition-transform">
                D
              </div>
              <span className="text-xl font-bold tracking-tight">
                Dyno Apps
              </span>
            </Link>
            <span className="h-6 w-[1px] bg-gray-200 hidden sm:block" />
            <h1 className="text-sm font-medium text-muted-foreground hidden sm:block">Project Gallery</h1>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all">
            <Link href="/builder">
              <PlusCircle className="w-4 h-4 mr-2" />
              New Project
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">My Projects</h2>
            <p className="text-muted-foreground">
              Manage and edit your mobile applications
            </p>
          </div>
          
          <div className="relative max-w-md w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search projects..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full md:w-64 bg-white/50 border-gray-200 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {actionError && (
          <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <span className="font-semibold">Error:</span> {actionError}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-white/50 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20 rounded-2xl border border-dashed bg-white/30">
            <p className="text-destructive font-medium">Error: {error}</p>
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
            {/* Create New Card */}
            <Link href="/builder" className="group">
              <Card className="h-full border-2 border-dashed border-gray-200 bg-white/40 hover:border-primary/50 hover:bg-white/60 transition-all duration-300 flex flex-col items-center justify-center p-6 cursor-pointer backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-white shadow-sm border flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                  <PlusCircle className="w-8 h-8 text-primary/60 group-hover:text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 group-hover:text-primary transition-colors">Create New Project</h3>
                <p className="text-sm text-muted-foreground text-center mt-2 max-w-[200px]">
                  Start a new app from scratch with AI
                </p>
              </Card>
            </Link>

            {filteredProjects.map((project) => (
              <Card key={project.id} className="group relative flex flex-col border-0 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white/70 backdrop-blur-md overflow-hidden">
                {/* Gradient Header Line */}
                <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-500 to-secondary opacity-70" />
                
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-xl font-bold line-clamp-1 group-hover:text-primary transition-colors">
                      {project.title}
                    </CardTitle>
                    
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mr-2 hover:bg-gray-100"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuOpenId((prev) => (prev === project.id ? null : project.id));
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                      
                      {menuOpenId === project.id && (
                        <div className="absolute right-0 mt-1 w-40 rounded-lg border bg-white shadow-lg z-30 py-1 animate-in fade-in zoom-in-95 duration-200">
                          <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-destructive/5 text-destructive flex items-center gap-2"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDelete(project.id);
                            }}
                            disabled={deletingProjectId === project.id}
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingProjectId === project.id ? "Deleting..." : "Delete Project"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2 h-10">
                    {project.description || "No description"}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  {/* Content placeholder if needed */}
                </CardContent>

                <CardFooter className="pt-0 flex items-center justify-between text-sm text-muted-foreground border-t bg-gray-50/50 p-4">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{project.lastModified}</span>
                  </div>
                  
                  <Button variant="secondary" size="sm" className="group-hover:bg-primary group-hover:text-white transition-colors" asChild>
                    <Link href={`/builder?projectId=${project.id}`}>
                      Open Project
                      <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-70" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 border border-dashed border-gray-300 rounded-3xl bg-white/30 backdrop-blur-sm">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No Projects Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              You haven't created any projects yet. Start building your first AI-powered mobile app today!
            </p>
            <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg" asChild>
              <Link href="/builder">
                <PlusCircle className="w-5 h-5 mr-2" />
                Create Your First App
              </Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
