"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Home() {
  const router = useRouter();
  const [appIdea, setAppIdea] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (appIdea.trim()) {
      router.push("/builder");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-3xl">
        <Card className="border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl lg:text-5xl font-bold">
              Dyno Apps
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
          <CardFooter className="flex justify-center">
            <Button asChild variant="outline">
              <Link href="/project-gallery">View Project Gallery</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
