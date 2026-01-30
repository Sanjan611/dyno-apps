"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, CreditCard, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBuilderStore } from "@/lib/store";
import PurchaseCreditsModal from "@/components/credits/PurchaseCreditsModal";
import { useBuyCreditsEnabled } from "@/lib/hooks/useFeatures";

interface Purchase {
  id: string;
  credits: number;
  amountCents: number;
  status: string;
  createdAt: string;
}

export default function BillingPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const { credits, refreshCredits } = useBuilderStore();
  const { enabled: buyCreditsEnabled } = useBuyCreditsEnabled();

  useEffect(() => {
    refreshCredits();
    fetchPurchases();
  }, [refreshCredits]);

  const fetchPurchases = async () => {
    try {
      const response = await fetch("/api/user/purchases");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch purchases");
      }

      setPurchases(data.purchases || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchases");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/project-gallery">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Billing</h1>
              <p className="text-muted-foreground">
                Manage your credits and view purchase history
              </p>
            </div>
          </div>
          {buyCreditsEnabled && (
            <Button onClick={() => setShowPurchaseModal(true)}>
              <CreditCard className="w-4 h-4 mr-2" />
              Buy Credits
            </Button>
          )}
        </div>

        {/* Balance Card */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Current Balance
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {credits.isLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      `${Math.max(credits.balance ?? 0, 0).toFixed(1)} credits`
                    )}
                  </p>
                </div>
              </div>
              {buyCreditsEnabled && (
                <Button
                  variant="outline"
                  onClick={() => setShowPurchaseModal(true)}
                >
                  Add More
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Purchase History</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">{error}</div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-8">
                <Coins className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  No purchases yet
                </p>
                {buyCreditsEnabled && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPurchaseModal(true)}
                    className="mt-4"
                  >
                    Buy Your First Credits
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">
                        {formatDate(purchase.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Coins className="w-4 h-4 text-amber-500" />
                          {purchase.credits}
                        </div>
                      </TableCell>
                      <TableCell>{formatAmount(purchase.amountCents)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            purchase.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : purchase.status === "refunded"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {purchase.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {buyCreditsEnabled && (
        <PurchaseCreditsModal
          isOpen={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
        />
      )}
    </div>
  );
}
