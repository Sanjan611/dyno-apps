"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FolderOpen } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [appIdea, setAppIdea] = useState("");
  const [projectCount, setProjectCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchProjectCount = async () => {
      try {
        const response = await fetch("/api/projects");
        const data = await response.json();
        if (data.success && data.projects) {
          setProjectCount(data.projects.length);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };
    fetchProjectCount();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appIdea.trim()) return;

    const params = new URLSearchParams({
      prompt: appIdea.trim(),
    });

    router.push(`/builder?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Menu Bar */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold">Dyno Apps</span>
          </Link>
          <Button variant="default" className="px-6">
            Login
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl">
          <Card className="border-0 shadow-none sm:border sm:shadow-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-4xl lg:text-5xl font-bold">
                Build Your App with AI
              </CardTitle>
              <CardDescription className="text-lg lg:text-xl mt-2">
                Build mobile applications using natural language with AI
              </CardDescription>
            </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="app-idea" className="text-lg">
                  What would you like to build?
                </Label>
                <Textarea
                  id="app-idea"
                  value={appIdea}
                  onChange={(e) => setAppIdea(e.target.value)}
                  placeholder="e.g., 'A fitness tracker app with workout logging and progress charts'"
                  className="w-full text-base lg:text-lg resize-none"
                  rows={4}
                />
              </div>
              <Button
                type="submit"
                disabled={!appIdea.trim()}
                className="w-full mt-4 text-lg py-6"
                size="lg"
              >
                Start Building
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Projects Card */}
        <Card className="border-0 shadow-none sm:border sm:shadow-sm mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              My Projects
            </CardTitle>
            <CardDescription>
              {projectCount !== null
                ? projectCount === 0
                  ? "You don't have any projects yet"
                  : `${projectCount} ${projectCount === 1 ? "project" : "projects"}`
                : "View and manage your projects"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/project-gallery">View All Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
