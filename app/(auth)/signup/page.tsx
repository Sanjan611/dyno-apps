"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * Signup page redirects to waitlist
 *
 * We use an invite-only system now, so users can't sign up directly.
 * This page informs them about the waitlist and redirects to the landing page.
 */
export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to home after 3 seconds
    const timeout = setTimeout(() => {
      router.push("/");
    }, 5000);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Join the Waitlist</CardTitle>
          <CardDescription className="mt-2">
            Dyno Apps is currently invite-only during beta
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            We&apos;re carefully onboarding new users to ensure a great experience.
            Request access and we&apos;ll send you an invite when a spot opens up.
          </p>

          <Button asChild className="w-full">
            <Link href="/">
              Request Beta Access
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
