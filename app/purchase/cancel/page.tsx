"use client";

import Link from "next/link";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PurchaseCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardContent className="pt-8 pb-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            Purchase Cancelled
          </h1>

          <p className="text-muted-foreground mb-6">
            Your payment was cancelled. No charges were made to your account.
          </p>

          <div className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/project-gallery">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span>Back to Projects</span>
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/billing">
                <CreditCard className="w-4 h-4 mr-2" />
                <span>Try Again</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
