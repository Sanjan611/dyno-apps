"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBuilderStore } from "@/lib/store";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { refreshCredits } = useBuilderStore();

  // Refresh credits when the page loads
  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  return (
    <Card className="max-w-md w-full shadow-xl">
      <CardContent className="pt-8 pb-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Payment Successful!
        </h1>

        <p className="text-muted-foreground mb-6">
          Your credits have been added to your account and are ready to use.
        </p>

        <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200 mb-6">
          <Coins className="w-5 h-5 text-amber-600" />
          <span className="text-amber-800 font-medium">
            Credits added to your balance
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/project-gallery">
              <span>Go to Projects</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href="/billing">View Purchase History</Link>
          </Button>
        </div>

        {sessionId && (
          <p className="text-xs text-muted-foreground mt-4">
            Session: {sessionId.slice(0, 20)}...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingFallback() {
  return (
    <Card className="max-w-md w-full shadow-xl">
      <CardContent className="pt-8 pb-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function PurchaseSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Suspense fallback={<LoadingFallback />}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
