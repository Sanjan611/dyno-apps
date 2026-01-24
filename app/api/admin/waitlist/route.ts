import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWaitlistEntries } from "@/lib/server/waitlistStore";

/**
 * Check if the current user is an admin
 */
async function isAdmin(): Promise<{ isAdmin: boolean; email?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { isAdmin: false };
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) =>
    e.trim().toLowerCase()
  );

  if (!adminEmails || adminEmails.length === 0) {
    console.error("[admin/waitlist] ADMIN_EMAILS not configured");
    return { isAdmin: false };
  }

  return {
    isAdmin: adminEmails.includes(user.email.toLowerCase()),
    email: user.email,
  };
}

export async function GET(request: NextRequest) {
  const { isAdmin: authorized } = await isAdmin();

  if (!authorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as
    | "pending"
    | "approved"
    | "rejected"
    | null;

  try {
    const entries = await getWaitlistEntries(status || undefined);

    return NextResponse.json({
      success: true,
      entries,
    });
  } catch (error) {
    console.error("[admin/waitlist] Error fetching entries:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch waitlist" },
      { status: 500 }
    );
  }
}
