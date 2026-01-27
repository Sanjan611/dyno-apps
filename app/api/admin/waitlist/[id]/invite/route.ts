import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getWaitlistEntryById,
  markAsInvited,
} from "@/lib/server/waitlistStore";
import { sendInviteEmail } from "@/lib/server/invite-email";

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

    // Generate invite link using Supabase admin API
    const serviceClient = createServiceClient();

    const origin =
      request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    const redirectTo = `${origin}/auth/callback`;

    const { data: inviteData, error: inviteError } =
      await serviceClient.auth.admin.generateLink({
        type: "invite",
        email: entry.email,
        options: {
          redirectTo,
          data: { invited: true },
        },
      });

    if (inviteError || !inviteData?.properties?.action_link) {
      console.error("[admin/invite] Failed to generate invite link:", inviteError);
      return NextResponse.json(
        {
          success: false,
          error: inviteError?.message || "Failed to generate invite link",
        },
        { status: 500 }
      );
    }

    const inviteLink = inviteData.properties.action_link;

    // Send the invite email
    const emailResult = await sendInviteEmail({
      email: entry.email,
      name: entry.name,
      inviteLink,
    });

    if (!emailResult.success) {
      console.error("[admin/invite] Failed to send email:", emailResult.error);
      return NextResponse.json(
        { success: false, error: `Failed to send email: ${emailResult.error}` },
        { status: 500 }
      );
    }

    // Mark as invited in the database
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
      message: `Invite sent to ${entry.email}`,
    });
  } catch (error) {
    console.error("[admin/invite] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send invite",
      },
      { status: 500 }
    );
  }
}
