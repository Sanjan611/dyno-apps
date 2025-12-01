"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FolderOpen, Sparkles, ArrowRight, Zap } from "lucide-react";
import { TypingAnimation } from "@/components/ui/typing-animation";

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
    <div className="min-h-screen relative overflow-hidden selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-white/60 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="bg-gradient-to-br from-primary to-secondary p-1.5 rounded-lg shadow-lg group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
              Dyno Apps
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            {projectCount !== null && projectCount > 0 && (
              <Link 
                href="/project-gallery"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden sm:block"
              >
                My Projects ({projectCount})
              </Link>
            )}
            <Button variant="default" className="bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all">
              Login
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center px-4 pt-20 pb-32">
        <div className="w-full max-w-4xl text-center space-y-8">
          
          {/* Hero Text */}
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/50 border border-primary/10 text-sm text-primary font-medium mb-2 backdrop-blur-sm shadow-sm hover:bg-white/80 transition-colors">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              AI-Powered App Builder
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight min-h-[1.1em]">
              <TypingAnimation text="Build your Dyno." />
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              From an idea in your head to an app on your phone.
              <br className="hidden md:block" />
              Built from the ground up for continued development and support.
            </p>
          </div>

          {/* Input Section */}
          <div className="max-w-2xl mx-auto w-full mt-12 relative group animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl opacity-20 group-hover:opacity-40 blur transition duration-500" />
            
            <Card className="relative border-0 shadow-2xl bg-white/80 backdrop-blur-xl">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="app-idea" className="text-lg font-semibold text-gray-800">
                      What are you building today?
                    </Label>
                    <Textarea
                      id="app-idea"
                      value={appIdea}
                      onChange={(e) => setAppIdea(e.target.value)}
                      placeholder="Describe your dream app (e.g., 'A meditation app with timers, calming sounds, and progress tracking...')"
                      className="min-h-[120px] text-lg resize-none border-gray-200 focus:border-primary/50 focus:ring-primary/20 bg-white/50 transition-all"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!appIdea.trim()}
                    className="w-full text-lg py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg hover:shadow-primary/25 transition-all duration-300 rounded-xl group/btn"
                  >
                    Start Building
                    <ArrowRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Quick Access / Gallery Link */}
          <div className="pt-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
             <div className="inline-block">
               <Link href="/project-gallery">
                <Card className="group cursor-pointer border-white/40 bg-white/40 hover:bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-1">
                  <CardContent className="p-6 flex items-center gap-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <FolderOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg">My Projects</h3>
                      <p className="text-muted-foreground">
                        {projectCount !== null
                          ? projectCount === 0
                            ? "No projects yet. Start one above!"
                            : `Continue working on your ${projectCount} project${projectCount === 1 ? '' : 's'}`
                          : "Loading..."}
                      </p>
                    </div>
                    <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
               </Link>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
