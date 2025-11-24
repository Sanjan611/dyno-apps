import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";

export async function POST(request: NextRequest) {
  try {
    console.log("[create-sandbox] Creating new sandbox...");
    
    // Modal credentials are read from environment variables
    // Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET in .env.local
    const modal = new ModalClient({
      tokenId: process.env.MODAL_TOKEN_ID,
      tokenSecret: process.env.MODAL_TOKEN_SECRET,
    });

    // Look up or create the Modal app
    console.log("[create-sandbox] Looking up or creating app...");
    const app = await modal.apps.fromName("dyno-apps", {
      createIfMissing: true,
    });
    console.log("[create-sandbox] App ready:", app.appId);

    // Create a sandbox with Node.js image
    console.log("[create-sandbox] Creating sandbox with node:20-slim image...");
    const image = modal.images.fromRegistry("node:20-slim");
    const sb = await modal.sandboxes.create(app, image, {
      unencryptedPorts: [19006],
    });
    console.log("[create-sandbox] Sandbox created:", sb.sandboxId);

    return NextResponse.json({
      success: true,
      sandboxId: sb.sandboxId,
      status: "created",
    });
  } catch (error) {
    console.error("[create-sandbox] Error creating sandbox:", error);
    if (error instanceof Error) {
      console.error("[create-sandbox] Error stack:", error.stack);
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

