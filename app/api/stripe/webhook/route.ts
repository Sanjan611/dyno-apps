/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for payment processing.
 * POST /api/stripe/webhook
 *
 * IMPORTANT: This endpoint must NOT use the withAuth middleware
 * as webhooks come directly from Stripe, not from authenticated users.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { getPackageByPriceId } from "@/lib/stripe/packages";
import { addCredits } from "@/lib/server/creditsStore";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const LOG_PREFIX = "[stripe/webhook]";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error(LOG_PREFIX, "Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(LOG_PREFIX, "STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(LOG_PREFIX, "Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCheckoutComplete(session, event.id);
  } else {
    console.log(LOG_PREFIX, `Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(
  session: Stripe.Checkout.Session,
  eventId: string
) {
  const userId = session.metadata?.userId;
  const priceId = session.metadata?.priceId;
  const packageId = session.metadata?.packageId;

  if (!userId || !priceId) {
    console.error(LOG_PREFIX, "Missing metadata:", { userId, priceId });
    return;
  }

  const pkg = getPackageByPriceId(priceId);
  if (!pkg) {
    console.error(LOG_PREFIX, "Unknown price ID:", priceId);
    return;
  }

  const supabase = createServiceClient();

  // Check for duplicate processing (idempotency)
  const { data: existingPurchase } = await supabase
    .from("credit_purchases")
    .select("id")
    .eq("stripe_event_id", eventId)
    .single();

  if (existingPurchase) {
    console.log(LOG_PREFIX, "Duplicate event, skipping:", eventId);
    return;
  }

  // Record the purchase
  const { error: insertError } = await supabase.from("credit_purchases").insert({
    user_id: userId,
    stripe_session_id: session.id,
    stripe_event_id: eventId,
    stripe_price_id: priceId,
    credits_purchased: pkg.credits,
    amount_paid_cents: session.amount_total || pkg.priceInCents,
    status: "completed",
  });

  if (insertError) {
    // If it's a unique constraint violation, another webhook already handled it
    if (insertError.code === "23505") {
      console.log(LOG_PREFIX, "Duplicate insert, skipping");
      return;
    }
    console.error(LOG_PREFIX, "Failed to record purchase:", insertError);
    throw insertError;
  }

  // Add credits to user's balance
  const result = await addCredits(userId, pkg.credits);

  if (result.success) {
    console.log(
      LOG_PREFIX,
      `Added ${pkg.credits} credits to user ${userId}`,
      `Package: ${packageId}, New balance: ${result.newBalance}`
    );
  } else {
    console.error(LOG_PREFIX, "Failed to add credits:", result.error);
    // The purchase is recorded, so admin can manually fix if needed
  }
}
