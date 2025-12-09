"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Zap, LogOut, User } from "lucide-react";
import { TypingAnimation } from "@/components/ui/typing-animation";
import { useAuthStore } from "@/lib/store";

export default function Home() {
  const { user, loading, checkAuth, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
            {loading ? (
              <div className="w-20 h-9 bg-gray-200 animate-pulse rounded-md" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground hidden sm:flex">
                  <User className="w-4 h-4" />
                  <span>{user.email}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={logout}
                  className="shadow-sm hover:shadow-md transition-all"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                asChild
                className="bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Link href="/login">Login</Link>
              </Button>
            )}
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

          {/* Get Started Button */}
          {user && (
            <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
              <Button
                asChild
                size="lg"
                className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg hover:shadow-primary/25 transition-all duration-300 rounded-xl group/btn"
              >
                <Link href="/project-gallery">
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
