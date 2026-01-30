/**
 * Credit Packages
 *
 * Defines the available credit packages for purchase.
 * Stripe Price IDs are configured via environment variables.
 */

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceInCents: number;
  stripePriceId: string;
  popular?: boolean;
}

/**
 * Get credit packages with Stripe Price IDs from environment.
 * Called at runtime to ensure env vars are available.
 */
export function getCreditPackages(): CreditPackage[] {
  return [
    {
      id: "starter",
      name: "Starter Pack",
      credits: 50,
      priceInCents: 500, // $5.00
      stripePriceId: process.env.STRIPE_PRICE_STARTER || "",
    },
    {
      id: "popular",
      name: "Popular Pack",
      credits: 100,
      priceInCents: 900, // $9.00 (10% savings)
      stripePriceId: process.env.STRIPE_PRICE_POPULAR || "",
      popular: true,
    },
    {
      id: "pro",
      name: "Pro Pack",
      credits: 250,
      priceInCents: 2000, // $20.00 (20% savings)
      stripePriceId: process.env.STRIPE_PRICE_PRO || "",
    },
  ];
}

/**
 * Find a package by its ID
 */
export function getPackageById(packageId: string): CreditPackage | undefined {
  return getCreditPackages().find((pkg) => pkg.id === packageId);
}

/**
 * Find a package by its Stripe Price ID (used in webhook)
 */
export function getPackageByPriceId(
  priceId: string
): CreditPackage | undefined {
  return getCreditPackages().find((pkg) => pkg.stripePriceId === priceId);
}

/**
 * Format price in cents to display string
 */
export function formatPrice(priceInCents: number): string {
  return `$${(priceInCents / 100).toFixed(2)}`;
}
