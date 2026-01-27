import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getWaitlistEntryById,
  markAsInvited,
} from "@/lib/server/waitlistStore";
import { sendApprovalEmail } from "@/lib/server/approval-email";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorized = await isAdmin();

  if (!authorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    // Get the waitlist entry
    const entry = await getWaitlistEntryById(id);

    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Waitlist entry not found" },
        { status: 404 }
      );
    }

    // Build the signup URL
    const origin =
      request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    const signupUrl = `${origin}/signup`;

    // Send the approval notification email
    const emailResult = await sendApprovalEmail({
      email: entry.email,
      name: entry.name,
      signupUrl,
    });

    if (!emailResult.success) {
      console.error("[admin/invite] Failed to send email:", emailResult.error);
      return NextResponse.json(
        { success: false, error: `Failed to send email: ${emailResult.error}` },
        { status: 500 }
      );
    }

    // Mark as approved in the database
    const updateResult = await markAsInvited(id);

    if (!updateResult.success) {
      console.error(
        "[admin/invite] Failed to update waitlist:",
        updateResult.error
      );
      // Email was sent, so we continue with success but log the error
    }

    return NextResponse.json({
      success: true,
      message: `Approval notification sent to ${entry.email}`,
    });
  } catch (error) {
    console.error("[admin/invite] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send notification",
      },
      { status: 500 }
    );
  }
}
