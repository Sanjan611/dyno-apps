import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addCredits, getUserCredits } from "@/lib/server/creditsStore";
import { createServiceClient } from "@/lib/supabase/service";

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
    return false;
  }

  return adminEmails.includes(user.email.toLowerCase());
}

/**
 * POST /api/admin/credits/[userId]/topup
 * Add credits to a user's balance
 * Body: { amount: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authorized = await isAdmin();

  if (!authorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 }
    );
  }

  const { userId } = await params;

  // Validate userId is a valid UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return NextResponse.json(
      { success: false, error: "Invalid user ID format" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { amount } = body;

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Check if user exists
    const serviceClient = createServiceClient();
    const { data: userData, error: userError } =
      await serviceClient.auth.admin.getUserById(userId);

    if (userError || !userData?.user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Ensure user has a credits record (auto-create if needed)
    // We need to use service client to insert for users who haven't logged in
    const { data: existingCredits } = await serviceClient
      .from("user_credits")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    if (!existingCredits) {
      // Create credits record for user
      const { error: insertError } = await serviceClient
        .from("user_credits")
        .insert({
          user_id: userId,
          balance: 0,
          total_credits_added: 0,
          total_credits_used: 0,
        });

      if (insertError && insertError.code !== "23505") {
        console.error(
          "[admin/credits/topup] Error creating credits record:",
          insertError
        );
        return NextResponse.json(
          { success: false, error: "Failed to initialize user credits" },
          { status: 500 }
        );
      }
    }

    // Add the credits
    const result = await addCredits(userId, amount);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to add credits" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      message: `Added ${amount} credits to user ${userData.user.email}`,
    });
  } catch (error) {
    console.error("[admin/credits/topup] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to add credits",
      },
      { status: 500 }
    );
  }
}
