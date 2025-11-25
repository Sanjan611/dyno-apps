import { NextRequest, NextResponse } from "next/server";
import { ModalClient, NotFoundError } from "modal";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sandboxId = searchParams.get("sandboxId");

    if (!sandboxId) {
      return NextResponse.json(
        {
          success: false,
          error: "sandboxId query parameter is required",
        },
        { status: 400 }
      );
    }

    try {
      const modal = new ModalClient({
        tokenId: process.env.MODAL_TOKEN_ID,
        tokenSecret: process.env.MODAL_TOKEN_SECRET,
      });

      // Try to get the sandbox - this will throw NotFoundError if it doesn't exist
      await modal.sandboxes.fromId(sandboxId);

      return NextResponse.json({
        success: true,
        exists: true,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({
          success: true,
          exists: false,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("[validate-sandbox] Error validating sandbox:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

