"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { X, Coins, Check, Loader2 } from "lucide-react";
import { getCreditPackages, formatPrice, type CreditPackage } from "@/lib/stripe/packages";

interface PurchaseCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PurchaseCreditsModal({
  isOpen,
  onClose,
}: PurchaseCreditsModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const packages = getCreditPackages();

  const handlePurchase = async (pkg: CreditPackage) => {
    setSelectedPackage(pkg.id);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start checkout");
      }

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
      setSelectedPackage(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center overflow-auto p-4">
      <Card className="my-auto max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95">
        <CardHeader className="relative">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="absolute right-4 top-4 p-1 rounded-full hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" />
            <CardTitle>Buy Credits</CardTitle>
          </div>
          <CardDescription>
            Choose a credit package to continue building
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => handlePurchase(pkg)}
              disabled={isLoading}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                pkg.popular
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              } ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:shadow-md"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      pkg.popular ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    <Coins
                      className={`w-5 h-5 ${
                        pkg.popular ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {pkg.name}
                      </span>
                      {pkg.popular && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                          Most Popular
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {pkg.credits} credits
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">
                    {formatPrice(pkg.priceInCents)}
                  </span>
                  {isLoading && selectedPackage === pkg.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <Check
                      className={`w-5 h-5 ${
                        pkg.popular ? "text-primary" : "text-transparent"
                      }`}
                    />
                  )}
                </div>
              </div>
            </button>
          ))}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-2">
            Secure payment powered by Stripe. Credits never expire.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
