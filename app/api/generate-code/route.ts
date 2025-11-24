import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";
import { b } from "@/baml_client";

export async function POST(request: NextRequest) {
  try {
    const { userPrompt, sandboxId } = await request.json();
    console.log("[generate-code] Starting code generation for sandbox:", sandboxId);

    // Validate input
    if (!userPrompt || !sandboxId) {
      console.error("[generate-code] Error: userPrompt and sandboxId are required");
      return NextResponse.json(
        {
          success: false,
          error: "userPrompt and sandboxId are required",
        },
        { status: 400 }
      );
    }

    // Validate Anthropic API key (required by BAML)
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[generate-code] Error: ANTHROPIC_API_KEY is not set");
      return NextResponse.json(
        {
          success: false,
          error: "ANTHROPIC_API_KEY environment variable is not configured",
        },
        { status: 500 }
      );
    }

    // Initialize Modal client
    const modal = new ModalClient({
      tokenId: process.env.MODAL_TOKEN_ID,
      tokenSecret: process.env.MODAL_TOKEN_SECRET,
    });

    // Get the sandbox reference
    console.log("[generate-code] Getting sandbox reference...");
    const sandbox = await modal.sandboxes.fromId(sandboxId);
    console.log("[generate-code] Sandbox reference obtained:", sandbox.sandboxId);

    // Read current App.js from the sandbox
    console.log("[generate-code] Reading current App.js from sandbox...");
    let currentAppJs = "";
    try {
      const appJsFile = await sandbox.open("/my-app/App.js", "r");
      const appJsContent = await appJsFile.read();
      currentAppJs = new TextDecoder().decode(appJsContent);
      await appJsFile.close();
      console.log("[generate-code] Current App.js read, length:", currentAppJs.length);
    } catch (error) {
      console.error("[generate-code] Error reading App.js:", error);
      // If file doesn't exist, we'll work with empty string
      if (error instanceof Error && !error.message.includes("ENOENT")) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to read App.js: ${error.message}`,
          },
          { status: 500 }
        );
      }
      console.log("[generate-code] App.js not found, will generate from scratch");
    }

    // Use BAML to generate code with structured output
    console.log("[generate-code] Calling BAML coding agent...");
    const result = await b.GenerateAppJsCode(
      userPrompt,
      currentAppJs || "// Empty file - create a new React Native app"
    );

    // Extract the generated code from BAML's structured response
    const generatedCode = result.code.trim();

    if (!generatedCode) {
      console.error("[generate-code] Error: Generated code is empty");
      return NextResponse.json(
        {
          success: false,
          error: "Generated code is empty",
        },
        { status: 500 }
      );
    }

    console.log("[generate-code] Code generated successfully, length:", generatedCode.length);

    // Write the new code back to App.js in the sandbox
    console.log("[generate-code] Writing generated code to App.js in sandbox...");
    const writeFile = await sandbox.open("/my-app/App.js", "w");
    await writeFile.write(new TextEncoder().encode(generatedCode));
    await writeFile.close();
    console.log("[generate-code] Code written successfully");

    return NextResponse.json({
      success: true,
      code: generatedCode,
    });
  } catch (error) {
    console.error("[generate-code] Error generating code:", error);
    if (error instanceof Error) {
      console.error("[generate-code] Error stack:", error.stack);
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

