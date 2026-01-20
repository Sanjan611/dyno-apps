"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertTriangle, Loader2 } from "lucide-react";

interface UnsavedChangesModalProps {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function UnsavedChangesModal({
  onSave,
  onDiscard,
  onCancel,
  isSaving,
}: UnsavedChangesModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-yellow-500/10">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            </div>
            <CardTitle>Unsaved Changes</CardTitle>
          </div>
          <CardDescription className="mt-2">
            You have unsaved changes. What would you like to do?
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onDiscard} disabled={isSaving}>
            Discard
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
