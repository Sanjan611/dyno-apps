import { NextRequest, NextResponse } from "next/server";
import { addToWaitlist } from "@/lib/server/waitlistStore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, company, useCase } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const result = await addToWaitlist(email, name, company, useCase);

    if (!result.success) {
      // Return 200 even for duplicates to not reveal if email exists
      if (result.error === "This email is already on the waitlist") {
        return NextResponse.json({
          success: true,
          message: "Thanks! We'll be in touch soon.",
        });
      }
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Thanks! We'll be in touch soon.",
    });
  } catch (error) {
    console.error("[api/waitlist] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to join waitlist. Please try again.",
      },
      { status: 500 }
    );
  }
}
