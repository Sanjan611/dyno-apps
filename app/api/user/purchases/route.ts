/**
 * User Purchases API
 *
 * Get the authenticated user's purchase history.
 * GET /api/user/purchases
 */

import { withAuth, successResponse, errorResponse } from "@/lib/server/api-utils";
import { createClient } from "@/lib/supabase/server";

const LOG_PREFIX = "[user/purchases]";

interface PurchaseRecord {
  id: string;
  credits_purchased: number;
  amount_paid_cents: number;
  stripe_price_id: string;
  status: string;
  created_at: string;
}

export const GET = withAuth(async (request, user) => {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("credit_purchases")
      .select("id, credits_purchased, amount_paid_cents, stripe_price_id, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(LOG_PREFIX, "Error fetching purchases:", error);
      return errorResponse("Failed to fetch purchases", 500);
    }

    const purchases = (data || []).map((record: PurchaseRecord) => ({
      id: record.id,
      credits: Number(record.credits_purchased),
      amountCents: record.amount_paid_cents,
      status: record.status,
      createdAt: record.created_at,
    }));

    return successResponse({ purchases });
  } catch (error) {
    console.error(LOG_PREFIX, "Exception fetching purchases:", error);
    return errorResponse("Failed to fetch purchases", 500);
  }
});
