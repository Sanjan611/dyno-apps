"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface NavigationWarningModalProps {
  onStay: () => void;
  onLeave: () => void;
}

/**
 * Modal warning user that navigating away will close the sandbox
 */
export default function NavigationWarningModal({
  onStay,
  onLeave,
}: NavigationWarningModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Leave Page?</CardTitle>
          </div>
          <CardDescription className="mt-2">
            Navigating away will close the sandbox. Please save your work before exiting if you&apos;d like to come back to this point.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onStay}>
            Stay
          </Button>
          <Button variant="destructive" onClick={onLeave}>
            Leave
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

