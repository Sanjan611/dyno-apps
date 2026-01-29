"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PlusCircle,
  Search,
  Trash2,
  ExternalLink,
  Clock,
  Sparkles,
  Zap,
  Loader2,
  Box,
  LayoutGrid,
  Calendar,
  Server,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProjectWithMeta } from "@/types";
import UserProfileDropdown from "@/components/builder/UserProfileDropdown";

export default function ProjectGalleryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithMeta[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithMeta[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [limitInfo, setLimitInfo] = useState<{ max: number; current: number; canCreate: boolean } | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // New state for row-based features
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailPanelProject, setDetailPanelProject] = useState<ProjectWithMeta | null>(null);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

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

  // Clear selection when filtered projects change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filteredProjects]);

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
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
        // Close detail panel if we just deleted that project
        if (detailPanelProject?.id === projectId) {
          setDetailPanelProject(null);
        }
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
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedIds.size} selected project${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeletingSelected(true);
    setActionError(null);

    const idsToDelete = Array.from(selectedIds);
    let deletedCount = 0;

    for (const projectId of idsToDelete) {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        if (data.success) {
          deletedCount++;
          setProjects((prev) => prev.filter((p) => p.id !== projectId));
        }
      } catch {
        // Continue with other deletions
      }
    }

    setSelectedIds(new Set());
    setIsDeletingSelected(false);

    // Refresh limit info
    try {
      const refreshResponse = await fetch("/api/projects");
      const refreshData = await refreshResponse.json();
      if (refreshData.success && refreshData.limit) {
        setLimitInfo(refreshData.limit);
      }
    } catch {
      // Ignore refresh errors
    }

    if (deletedCount < idsToDelete.length) {
      setActionError(`Deleted ${deletedCount} of ${idsToDelete.length} projects. Some deletions failed.`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProjects.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isAllSelected = filteredProjects.length > 0 && selectedIds.size === filteredProjects.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredProjects.length;

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
          <div className="flex items-center gap-3">
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
            <UserProfileDropdown />
          </div>
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
          <div className="mb-6 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-5 duration-500 delay-100">
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

        {/* Bulk Actions Toolbar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-4 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-sm font-medium text-primary">
              {selectedIds.size} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isDeletingSelected}
              className="rounded-lg"
            >
              {isDeletingSelected ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-muted-foreground"
            >
              Clear selection
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm overflow-hidden">
            <div className="animate-pulse">
              <div className="h-12 bg-slate-100/50 border-b" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 border-b border-slate-100 flex items-center gap-4 px-4">
                  <div className="w-4 h-4 bg-slate-200 rounded" />
                  <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                  <div className="w-48 h-4 bg-slate-200 rounded" />
                  <div className="w-32 h-4 bg-slate-200 rounded ml-auto" />
                </div>
              ))}
            </div>
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
          <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-slate-200/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isSomeSelected;
                        }
                      }}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700">Project</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-[250px]">Description</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-[150px]">Last Modified</TableHead>
                  <TableHead className="font-semibold text-slate-700 w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow
                    key={project.id}
                    data-state={selectedIds.has(project.id) ? "selected" : undefined}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      // Don't open panel if clicking checkbox or action buttons
                      const target = e.target as HTMLElement;
                      if (target.closest('[role="checkbox"]') || target.closest('button') || target.closest('a')) {
                        return;
                      }
                      setDetailPanelProject(project);
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(project.id)}
                        onCheckedChange={() => toggleSelectOne(project.id)}
                        aria-label={`Select ${project.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                          <Box className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-slate-900 group-hover:text-primary transition-colors">
                          {project.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-500 text-sm line-clamp-1">
                        {project.description || "No description"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                        <Clock className="w-3.5 h-3.5" />
                        {project.lastModified}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3 text-xs font-medium hover:bg-primary hover:text-white transition-colors rounded-lg"
                        asChild
                      >
                        <Link href={`/builder/${project.id}`}>
                          Open
                          <ExternalLink className="w-3 h-3 ml-1.5 opacity-70" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredProjects.length === 0 && searchQuery && (
              <div className="py-12 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No projects match your search.</p>
              </div>
            )}
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

      {/* Project Detail Sheet */}
      <Sheet open={!!detailPanelProject} onOpenChange={(open) => !open && setDetailPanelProject(null)}>
        <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
          {detailPanelProject && (
            <>
              <SheetHeader className="pb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center text-primary mb-4">
                  <Box className="w-6 h-6" />
                </div>
                <SheetTitle className="text-xl">{detailPanelProject.title}</SheetTitle>
                <SheetDescription>
                  {detailPanelProject.description || "No description provided."}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                {/* Project Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="font-medium text-slate-900">{formatDate(detailPanelProject.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Modified</p>
                      <p className="font-medium text-slate-900">{detailPanelProject.lastModified}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sandbox</p>
                      <p className="font-medium text-slate-900">
                        {detailPanelProject.currentSandboxId ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                            Not started
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-6 border-t space-y-3">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 rounded-xl h-11"
                    asChild
                  >
                    <Link href={`/builder/${detailPanelProject.id}`}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Builder
                    </Link>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-11 text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20"
                    onClick={() => handleDelete(detailPanelProject.id)}
                    disabled={deletingProjectId === detailPanelProject.id}
                  >
                    {deletingProjectId === detailPanelProject.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Project
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
