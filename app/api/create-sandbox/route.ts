import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";

export async function POST(request: NextRequest) {
  try {
    // Modal credentials are read from environment variables
    // Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET in .env.local
    const modal = new ModalClient({
      tokenId: process.env.MODAL_TOKEN_ID,
      tokenSecret: process.env.MODAL_TOKEN_SECRET,
    });

    // Look up or create the Modal app
    const app = await modal.apps.fromName("dyno-apps", {
      createIfMissing: true,
    });

    // Create a sandbox with default debian_slim image
    const image = modal.images.fromRegistry("python:3.13-slim");
    const sb = await modal.sandboxes.create(app, image);

    return NextResponse.json({
      success: true,
      sandboxId: sb.sandboxId,
      status: "created",
    });
  } catch (error) {
    console.error("Error creating sandbox:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

