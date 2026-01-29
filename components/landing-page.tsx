"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  Twitter,
  Github,
  Globe
} from "lucide-react";
import { TypingAnimation } from "@/components/ui/typing-animation";
import { useAuthStore } from "@/lib/store";
import { WaitlistForm } from "@/components/waitlist-form";
import { PhoneMockup } from "@/components/landing/phone-mockup";
import { HowItWorks } from "@/components/landing/how-it-works";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import UserProfileDropdown from "@/components/builder/UserProfileDropdown";

export default function LandingPage() {
  const { user, loading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <div className="min-h-screen relative selection:bg-primary/20 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-white/60 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 relative">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="bg-gradient-to-br from-primary to-secondary p-1.5 rounded-lg shadow-lg group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
              Dyno Apps
            </span>
          </Link>
          

          <div className="flex items-center">
            {loading ? (
              <div className="w-20 h-9 bg-gray-200 animate-pulse rounded-md" />
            ) : user ? (
              <UserProfileDropdown />
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  asChild
                  className="shadow-sm hover:shadow-md transition-all"
                >
                  <Link href="/signup">Sign Up</Link>
                </Button>
                <Button
                  variant="default"
                  asChild
                  className="bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <Link href="/login">Login</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-20 relative overflow-hidden">
        {/* Floating gradient orbs */}
        <div className="absolute top-20 -left-32 w-96 h-96 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-3xl animate-gradient-shift pointer-events-none" />
        <div className="absolute top-60 -right-32 w-80 h-80 bg-gradient-to-br from-secondary/15 to-pink-500/15 rounded-full blur-3xl animate-gradient-shift-slow pointer-events-none" />
        <div className="absolute top-[500px] left-1/4 w-72 h-72 bg-gradient-to-br from-pink-500/10 to-orange-400/10 rounded-full blur-3xl animate-gradient-shift-delayed pointer-events-none" />

        <div className="w-full px-4 md:px-6 space-y-24 relative z-10">

          {/* Hero Section */}
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
              {/* Left side - Text content */}
              <div className="flex-1 max-w-xl text-center lg:text-left">
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {/* Hero Badge */}
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-4 animate-shimmer">
                    <span className="relative flex h-2 w-2 mr-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    10 free credits to start building
                  </div>

                  <h1 className="text-5xl md:text-7xl font-bold tracking-tight min-h-[1.1em] text-foreground drop-shadow-sm">
                    <TypingAnimation text="Build your Dyno." />
                  </h1>
                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                    Turn your app idea into a working mobile app in minutes.
                    <br className="hidden md:block" />
                    No coding required.
                  </p>
                </div>

                {/* CTA Section */}
                <div className="mt-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                  {user ? (
                    <>
                      <Button
                        asChild
                        size="lg"
                        className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all duration-300 rounded-xl group/btn"
                      >
                        <Link href="/project-gallery">
                          Go to Dashboard
                          <ArrowRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Card className="max-w-md mx-auto lg:mx-0 glass-card border-primary/20">
                      <CardHeader className="text-center lg:text-left pb-2">
                        <CardTitle className="text-xl">Start Building for Free</CardTitle>
                        <CardDescription>
                          Join the waitlist and we&apos;ll send you an invite
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <WaitlistForm />
                      </CardContent>
                    </Card>
                  )}
                  <p className="mt-4 text-sm text-muted-foreground">
                    10 free credits included · No credit card required
                  </p>
                </div>
              </div>

              {/* Right side - Phone Mockup */}
              <div className="hidden lg:flex flex-shrink-0 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <PhoneMockup />
              </div>
            </div>
          </div>

          {/* How It Works Section */}
          <HowItWorks />

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/20 bg-white/40 backdrop-blur-md py-12 mt-auto">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-br from-primary to-secondary p-1 rounded-md shadow-sm">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold">Dyno Apps</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Building the future of mobile app development with AI.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/signup" className="hover:text-foreground">Sign Up</Link></li>
                <li><Link href="/login" className="hover:text-foreground">Login</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-foreground">Terms of Service</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Connect</h3>
              <div className="flex space-x-4">
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <Twitter className="w-5 h-5" />
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <Github className="w-5 h-5" />
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <Globe className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-black/5 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Dyno Apps. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
