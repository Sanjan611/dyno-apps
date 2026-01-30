/**
 * Stripe Client
 *
 * Server-side Stripe client initialization.
 * Only use this in server-side code (API routes, server components).
 */

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * Get the Stripe client instance.
 * Uses lazy initialization to avoid errors during build.
 */
export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}
