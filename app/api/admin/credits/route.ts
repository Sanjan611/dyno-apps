import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllUserCredits } from "@/lib/server/creditsStore";

/**
 * Check if the current user is an admin
 */
async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return false;
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) =>
    e.trim().toLowerCase()
  );

  if (!adminEmails || adminEmails.length === 0) {
    console.error("[admin/credits] ADMIN_EMAILS not configured");
    return false;
  }

  return adminEmails.includes(user.email.toLowerCase());
}

/**
 * GET /api/admin/credits
 * Returns all users with their credit balances
 */
export async function GET(request: NextRequest) {
  const authorized = await isAdmin();

  if (!authorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.toLowerCase();

  try {
    const users = await getAllUserCredits();

    // Filter by email search if provided
    const filtered = search
      ? users.filter((u) => u.email?.toLowerCase().includes(search))
      : users;

    return NextResponse.json({
      success: true,
      users: filtered,
    });
  } catch (error) {
    console.error("[admin/credits] Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user credits" },
      { status: 500 }
    );
  }
}
