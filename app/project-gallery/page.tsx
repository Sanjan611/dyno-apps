"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  MoreVertical, 
  PlusCircle, 
  Search, 
  Trash2, 
  ExternalLink, 
  Clock, 
  Sparkles, 
  Zap, 
  Loader2, 
  Box, 
  LayoutGrid 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProjectWithMeta } from "@/types";

export default function ProjectGalleryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithMeta[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithMeta[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [limitInfo, setLimitInfo] = useState<{ max: number; current: number; canCreate: boolean } | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/projects");
        const data = await response.json();

        if (data.success) {
          setProjects(data.projects || []);
          setFilteredProjects(data.projects || []);
          if (data.limit) {
            setLimitInfo(data.limit);
          }
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

  const handleCreateNewProject = async () => {
    if (limitInfo && !limitInfo.canCreate) {
      setActionError(
        `You have reached your project limit (${limitInfo.current}/${limitInfo.max}). Please delete a project to create a new one.`
      );
      setTimeout(() => setActionError(null), 5000);
      return;
    }

    setIsCreatingProject(true);
    setActionError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: null,
          description: null,
          firstMessage: null,
        }),
      });

      const data = await response.json();

      if (data.success && data.project?.id) {
        router.push(`/builder/${data.project.id}`);
      } else {
        setActionError(data.error || "Failed to create project");
        setIsCreatingProject(false);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create project");
      setIsCreatingProject(false);
    }
  };

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
        const refreshResponse = await fetch("/api/projects");
        const refreshData = await refreshResponse.json();
        if (refreshData.success && refreshData.limit) {
          setLimitInfo(refreshData.limit);
        }
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
    <div className="min-h-screen bg-slate-50 relative selection:bg-primary/20">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-primary/5 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-secondary/5 rounded-full blur-3xl opacity-50" />
      </div>

      {/* Header */}
      <header className="border-b bg-white/70 backdrop-blur-xl sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                Dyno Apps
              </span>
            </Link>
            <span className="h-6 w-[1px] bg-gray-200 hidden sm:block" />
            <h1 className="text-sm font-medium text-muted-foreground hidden sm:block flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              Project Gallery
            </h1>
          </div>
          <Button 
            className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg hover:shadow-primary/20 transition-all rounded-full px-6"
            disabled={isCreatingProject || (limitInfo ? !limitInfo.canCreate : false)}
            title={limitInfo && !limitInfo.canCreate ? `Project limit reached (${limitInfo.current}/${limitInfo.max})` : undefined}
            onClick={handleCreateNewProject}
          >
            {isCreatingProject ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 mr-2" />
                New Project
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 relative z-10">
        {/* Welcome Section */}
        <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white border border-primary/10 text-sm text-primary font-medium mb-6 shadow-sm hover:shadow-md transition-shadow cursor-default">
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            Welcome Back
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-gray-900">
            Your Projects
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Create, manage, and continue building your AI-powered mobile applications.
          </p>
        </div>

        {/* Search Bar */}
        {projects.length > 0 && (
          <div className="mb-10 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-5 duration-500 delay-100">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 w-full h-12 bg-white/80 border-gray-200 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-primary/20 rounded-2xl"
              />
            </div>
          </div>
        )}

        {actionError && (
          <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="font-semibold">Error:</span> {actionError}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white/50 animate-pulse border border-white/20" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-destructive/30 bg-destructive/5">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
            {/* Create New Card */}
            <button
              onClick={handleCreateNewProject}
              disabled={isCreatingProject || (limitInfo ? !limitInfo.canCreate : false)}
              className="group text-left h-full focus:outline-none"
              style={limitInfo && !limitInfo.canCreate ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              <Card className="h-full border-2 border-dashed border-primary/20 bg-white/50 hover:bg-white/80 hover:border-primary/40 transition-all duration-300 flex flex-col items-center justify-center p-8 cursor-pointer rounded-3xl shadow-sm hover:shadow-xl group-focus:ring-2 group-focus:ring-primary/20">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                  {isCreatingProject ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  ) : (
                    <PlusCircle className="w-8 h-8 text-primary" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-800 group-hover:text-primary transition-colors mb-2">
                  {isCreatingProject ? "Creating..." : "Create New Project"}
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-[200px]">
                  Start fresh with a new AI-powered mobile app
                </p>
              </Card>
            </button>

            {filteredProjects.map((project) => (
              <Card key={project.id} className="group relative flex flex-col border-white/40 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 bg-white/70 backdrop-blur-md overflow-hidden rounded-3xl">
                {/* Gradient Header Line */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-purple-500 to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <CardHeader className="pb-2 pt-6">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-gray-500 group-hover:text-primary transition-colors border border-gray-100">
                        <Box className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-lg font-bold line-clamp-1 group-hover:text-primary transition-colors">
                        {project.title}
                      </CardTitle>
                    </div>
                    
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground hover:bg-gray-100/50 rounded-full"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuOpenId((prev) => (prev === project.id ? null : project.id));
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                      
                      {menuOpenId === project.id && (
                        <div className="absolute right-0 mt-1 w-40 rounded-xl border bg-white shadow-xl z-30 py-1 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                          <button
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-destructive/5 text-destructive flex items-center gap-2 transition-colors"
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
                  <CardDescription className="line-clamp-2 h-10 mt-3 text-sm leading-relaxed">
                    {project.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                
                <div className="flex-1" />

                <CardFooter className="pt-0 flex items-center justify-between text-xs text-muted-foreground border-t border-gray-100/50 bg-white/30 p-4 mt-4">
                  <div className="flex items-center gap-1.5" title="Last modified">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{project.lastModified}</span>
                  </div>
                  
                  <Button variant="secondary" size="sm" className="h-8 px-4 text-xs font-medium group-hover:bg-primary group-hover:text-white transition-colors rounded-lg shadow-sm" asChild>
                    <Link href={`/builder/${project.id}`}>
                      Open
                      <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center py-20 px-8 border border-dashed border-primary/20 rounded-[2.5rem] bg-white/40 backdrop-blur-sm relative overflow-hidden">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-white to-gray-50 shadow-xl flex items-center justify-center mx-auto mb-8 animate-in fade-in zoom-in-95 duration-500 border border-white">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white">
                    <Zap className="w-8 h-8 fill-current" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold mb-4 text-gray-900">
                  Start Your First Project
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed">
                  Turn your ideas into reality. Describe what you want to build, and our AI will help you bring it to life instantly.
                </p>
                <Button 
                  size="lg" 
                  className="px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-xl hover:shadow-primary/25 transition-all duration-300 rounded-2xl group/btn text-lg" 
                  disabled={isCreatingProject || (limitInfo ? !limitInfo.canCreate : false)}
                  title={limitInfo && !limitInfo.canCreate ? `Project limit reached (${limitInfo.current}/${limitInfo.max})` : undefined}
                  onClick={handleCreateNewProject}
                >
                  {isCreatingProject ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creating Project...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-5 h-5 mr-2 group-hover/btn:rotate-90 transition-transform duration-300" />
                      Create New Project
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
