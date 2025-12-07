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
import { MoreVertical, PlusCircle, Search, Trash2, ExternalLink, Clock, FolderOpen, Sparkles, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProjectWithMeta } from "@/types";

export default function ProjectGalleryPage() {
  const [projects, setProjects] = useState<ProjectWithMeta[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithMeta[]>([]);
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
      `Delete "${project.title}"? This cannot be undone.`
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
        {/* Welcome Section */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary font-medium mb-4 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            Welcome to Your Project Gallery
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Your Projects
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Create, manage, and continue building your AI-powered mobile applications
          </p>
        </div>

        {/* Search Bar */}
        {projects.length > 0 && (
          <div className="mb-8 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full bg-white/70 border-gray-200 focus:bg-white transition-colors shadow-sm"
              />
            </div>
          </div>
        )}

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
              <Card className="h-full border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 hover:border-primary/60 hover:from-primary/10 hover:to-secondary/10 transition-all duration-300 flex flex-col items-center justify-center p-8 cursor-pointer backdrop-blur-sm relative overflow-hidden">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-secondary/0 group-hover:from-primary/10 group-hover:to-secondary/10 transition-all duration-300" />
                <div className="relative z-10">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary shadow-lg flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                    <PlusCircle className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 group-hover:text-primary transition-colors mb-2">
                    Create New Project
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-[220px]">
                    Start building a new AI-powered mobile app from scratch
                  </p>
                </div>
              </Card>
            </Link>

            {filteredProjects.map((project) => (
              <Card key={project.id} className="group relative flex flex-col border-0 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 bg-white/80 backdrop-blur-md overflow-hidden">
                {/* Gradient Header Line */}
                <div className="h-2 w-full bg-gradient-to-r from-primary via-purple-500 to-secondary opacity-80 group-hover:opacity-100 transition-opacity" />
                
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
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-20 px-8 border-2 border-dashed border-primary/30 rounded-3xl bg-gradient-to-br from-primary/5 via-white to-secondary/5 backdrop-blur-sm relative overflow-hidden">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary shadow-xl flex items-center justify-center mx-auto mb-6 animate-in fade-in zoom-in-95">
                  <Zap className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                  Ready to Build Your First App?
                </h3>
                <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-10 leading-relaxed">
                  Start creating your first AI-powered mobile application. Describe what you want to build, and our AI will help you bring it to life.
                </p>
                <Button 
                  size="lg" 
                  className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl group/btn" 
                  asChild
                >
                  <Link href="/builder">
                    <PlusCircle className="w-5 h-5 mr-2 group-hover/btn:rotate-90 transition-transform duration-300" />
                    Create Your First Project
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
