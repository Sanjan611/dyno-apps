"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2 } from "lucide-react";

interface WaitlistFormProps {
  className?: string;
  compact?: boolean;
}

export function WaitlistForm({ className = "", compact = false }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, useCase }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={`p-6 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900 dark:text-green-100">
              You&apos;re on the list!
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              We&apos;ll review your request and send an invite soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Join Waitlist"
          )}
        </Button>
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="waitlist-email">Email *</Label>
        <Input
          id="waitlist-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-name">Name</Label>
        <Input
          id="waitlist-name"
          type="text"
          placeholder="John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-usecase">What will you build?</Label>
        <Textarea
          id="waitlist-usecase"
          placeholder="Tell us about the app you want to create..."
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          disabled={isLoading}
          rows={3}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          "Request Access"
        )}
      </Button>
    </form>
  );
}
