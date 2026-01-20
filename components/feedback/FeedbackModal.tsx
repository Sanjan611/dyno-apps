"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Bug, Lightbulb, MessageCircle, CheckCircle2, Loader2 } from "lucide-react";

type FeedbackType = "bug" | "feature" | "general";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

const feedbackTypes: { type: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { type: "bug", label: "Bug Report", icon: <Bug className="w-4 h-4" /> },
  { type: "feature", label: "Feature Request", icon: <Lightbulb className="w-4 h-4" /> },
  { type: "general", label: "General", icon: <MessageCircle className="w-4 h-4" /> },
];

const placeholders: Record<FeedbackType, string> = {
  bug: "Please describe the bug you encountered. Include steps to reproduce if possible...",
  feature: "Describe the feature you'd like to see. What problem would it solve?",
  general: "Share your thoughts, suggestions, or anything else you'd like us to know...",
};

export default function FeedbackModal({ isOpen, onClose, userEmail }: FeedbackModalProps) {
  const [email, setEmail] = useState(userEmail || "");
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(userEmail || "");
      setType("general");
      setMessage("");
      setError(null);
      setIsSuccess(false);
    }
  }, [isOpen, userEmail]);

  // Auto-close after success
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send feedback");
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95">
        {isSuccess ? (
          <div className="p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Thank you!</h3>
            <p className="text-muted-foreground">Your feedback has been sent successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardHeader className="relative">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              <CardTitle>Send Feedback</CardTitle>
              <CardDescription>
                Help us improve Dyno Apps with your feedback
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Feedback Type</Label>
                <div className="flex gap-2">
                  {feedbackTypes.map(({ type: t, label, icon }) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        type === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {icon}
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={placeholders[type]}
                  rows={5}
                  required
                  className="resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </CardContent>

            <CardFooter className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !message.trim()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Feedback"
                )}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
