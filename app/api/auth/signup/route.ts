import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, inviteCode } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Email and password are required",
        },
        { status: 400 }
      );
    }

    // Validate invite code
    if (!inviteCode || typeof inviteCode !== "string" || inviteCode.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "Invite code is required",
        },
        { status: 400 }
      );
    }

    const betaInviteCodesEnv = process.env.BETA_INVITE_CODES;
    
    if (!betaInviteCodesEnv || betaInviteCodesEnv.trim() === "") {
      console.error("[auth/signup] BETA_INVITE_CODES environment variable is not set");
      return NextResponse.json(
        {
          success: false,
          error: "Beta access is not configured. Please contact support.",
        },
        { status: 500 }
      );
    }

    const validCodes = betaInviteCodesEnv
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code.length > 0);
    
    if (validCodes.length === 0) {
      console.error("[auth/signup] No valid invite codes found in BETA_INVITE_CODES");
      return NextResponse.json(
        {
          success: false,
          error: "Beta access is not configured. Please contact support.",
        },
        { status: 500 }
      );
    }

    const trimmedInviteCode = inviteCode.trim();
    if (!validCodes.includes(trimmedInviteCode)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid invite code",
        },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name || "",
        },
      },
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data.user,
    });
  } catch (error) {
    console.error("[auth/signup] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

