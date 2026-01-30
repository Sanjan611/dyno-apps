/**
 * Stripe Checkout API
 *
 * Creates a Stripe Checkout Session for credit purchases.
 * POST /api/stripe/checkout
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getPackageById } from "@/lib/stripe/packages";
import {
  withAuth,
  successResponse,
  badRequestResponse,
  errorResponse,
} from "@/lib/server/api-utils";

const LOG_PREFIX = "[stripe/checkout]";

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { packageId } = body;

    if (!packageId || typeof packageId !== "string") {
      return badRequestResponse("Package ID is required");
    }

    const pkg = getPackageById(packageId);
    if (!pkg) {
      return badRequestResponse("Invalid package ID");
    }

    if (!pkg.stripePriceId) {
      console.error(LOG_PREFIX, "Missing Stripe Price ID for package:", packageId);
      return errorResponse("Payment configuration error", 500);
    }

    const stripe = getStripeClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: pkg.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/purchase/cancel`,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        priceId: pkg.stripePriceId,
        packageId: pkg.id,
        credits: pkg.credits.toString(),
      },
    });

    console.log(
      LOG_PREFIX,
      `Created checkout session for user ${user.id}`,
      `package: ${pkg.id}, credits: ${pkg.credits}`
    );

    return successResponse({ checkoutUrl: session.url });
  } catch (error) {
    console.error(LOG_PREFIX, "Error creating checkout session:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create checkout session",
      500
    );
  }
});
