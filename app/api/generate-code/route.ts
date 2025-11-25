import { NextRequest, NextResponse } from "next/server";
import { ModalClient } from "modal";
import { b } from "@/baml_client";
import type {
  ListFilesTool,
  ReadFileTool,
  WriteFileTool,
  Message,
  ReplyToUser,
  FileTools,
} from "@/baml_client/types";

// Tool execution functions - return error strings on failure
async function executeListFiles(
  sandbox: any,
  tool: ListFilesTool
): Promise<string> {
  try {
    // Use ls command to list directory contents
    const lsProcess = await sandbox.exec(["ls", "-la", tool.directoryPath]);
    const output = await lsProcess.stdout.readText();
    await lsProcess.wait();
    
    // Parse the output to extract files and directories
    const lines = output.split("\n").filter((line: string) => line.trim());
    const files: string[] = [];
    const directories: string[] = [];
    
    // Skip the first line (total) and parse each line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 9) {
        const name = parts.slice(8).join(" ");
        // Skip . and ..
        if (name === "." || name === "..") continue;
        
        // Check if it's a directory (starts with 'd')
        if (parts[0].startsWith("d")) {
          directories.push(name);
        } else {
          files.push(name);
        }
      }
    }
    
    return `Listed directory ${tool.directoryPath}:\nFiles: ${files.join(", ")}\nDirectories: ${directories.join(", ")}`;
  } catch (error) {
    // Return error message so agent can handle it
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Error listing directory ${tool.directoryPath}: ${errorMessage}. Please check the path and try again.`;
  }
}

async function executeReadFile(
  sandbox: any,
  tool: ReadFileTool
): Promise<string> {
  try {
    const file = await sandbox.open(tool.filePath, "r");
    const content = await file.read();
    await file.close();
    const decoded = new TextDecoder().decode(content);
    return `Read file ${tool.filePath}:\n${decoded}`;
  } catch (error) {
    // Return error message so agent can handle it
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Error reading file ${tool.filePath}: ${errorMessage}. The file may not exist or the path may be incorrect.`;
  }
}

async function executeWriteFile(
  sandbox: any,
  tool: WriteFileTool
): Promise<string> {
  try {
    const file = await sandbox.open(tool.filePath, "w");
    await file.write(new TextEncoder().encode(tool.content));
    await file.close();
    return `Successfully wrote file ${tool.filePath}`;
  } catch (error) {
    // Return error message so agent can handle it
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Error writing file ${tool.filePath}: ${errorMessage}. Please check the path and content format.`;
  }
}

// Helper function to extract code from message state
function extractCodeFromState(state: Message[]): string {
  // Look for the last WriteFileTool that wrote to App.js
  for (let i = state.length - 1; i >= 0; i--) {
    const msg = state[i];
    if (
      msg.role === "assistant" &&
      typeof msg.message !== "string" &&
      "action" in msg.message &&
      msg.message.action === "write_file" &&
      msg.message.filePath === "/my-app/App.js"
    ) {
      return msg.message.content;
    }
  }
  return "";
}

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

    // Initialize message state
    const state: Message[] = [
      {
        role: "user",
        message: userPrompt,
      },
    ];

    // Initialize variables
    let currentAppJsCode = ""; // Track App.js code for extraction
    const maxIterations = 5;
    let iterations = 0;

    // Agentic loop (max 5 iterations)
    console.log("[generate-code] Starting agentic loop...");
    while (iterations < maxIterations) {
      iterations++;
      console.log(`[generate-code] Iteration ${iterations}/${maxIterations}`);

      // Call BAML agent
      const response = await b.AgentLoop(state, "/my-app");

      // Check if agent is replying (done)
      if (response.action === "reply_to_user") {
        // Extract code from last WriteFileTool if available, otherwise from tracked currentAppJsCode
        const finalCode =
          currentAppJsCode || extractCodeFromState(state);

        console.log("[generate-code] Agent completed with reply:", response.message);
        return NextResponse.json({
          success: true,
          message: response.message, // User-friendly message
          code: finalCode, // Generated code for preview/internal use
        });
      }

      // Execute the tool (response is FileTools)
      let result: string;
      if (response.action === "list_files") {
        console.log("[generate-code] Executing list_files tool...");
        result = await executeListFiles(sandbox, response);
      } else if (response.action === "read_file") {
        console.log("[generate-code] Executing read_file tool...");
        result = await executeReadFile(sandbox, response);
        // Track App.js code when reading
        if (
          response.filePath === "/my-app/App.js" &&
          !result.startsWith("Error")
        ) {
          const codeMatch = result.match(/Read file.*:\n([\s\S]*)/);
          if (codeMatch) {
            currentAppJsCode = codeMatch[1];
          }
        }
      } else if (response.action === "write_file") {
        console.log("[generate-code] Executing write_file tool...");
        result = await executeWriteFile(sandbox, response);
        // Track App.js code when writing
        if (
          response.filePath === "/my-app/App.js" &&
          !result.startsWith("Error")
        ) {
          currentAppJsCode = response.content;
        }
      } else {
        result = `Unknown tool action: ${(response as FileTools).action}`;
      }

      // Add tool execution to state (including errors - agent can handle them)
      state.push({
        role: "assistant",
        message: response, // The tool that was executed
      });
      state.push({
        role: "user",
        message: result, // The result of tool execution (including errors)
      });
    }

    // Handle timeout if loop exceeds max iterations
    console.error(
      "[generate-code] Agent exceeded maximum iterations"
    );
    return NextResponse.json(
      {
        success: false,
        error:
          "Agent exceeded maximum iterations. Please try again with a simpler request.",
      },
      { status: 500 }
    );
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

