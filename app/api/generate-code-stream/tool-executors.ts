import { dirname } from "path";
import type {
  ListFilesTool,
  ReadFileTool,
  WriteFileTool,
  BashTool,
  Message,
  FileTools,
  TodoItem,
  TodoWriteTool,
  TodoTools,
} from "@/baml_client/types";

// Type for single (non-array) tools
export type SingleTool = ListFilesTool | ReadFileTool | WriteFileTool | BashTool | TodoWriteTool;

// Result interface for single tool execution
export interface SingleToolResult {
  result: string;
  updatedTodoList?: TodoItem[];  // Only populated for todo_write
}

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

// Lint check function - runs Prettier (auto-fix) and ESLint, returns raw output
async function executeLintCheck(
  sandbox: any,
  workingDir: string
): Promise<string> {
  try {
    console.log("[generate-code-stream] Running lint check in", workingDir);

    let result = "Lint check results:\n\n";
    
    // Run Prettier with --write to auto-fix formatting issues
    const prettierProcess = await sandbox.exec([
      "bash",
      "-c",
      `cd ${workingDir} && npx prettier --write "**/*.{js,jsx,ts,tsx}" 2>&1 || echo "Prettier check completed"`,
    ]);
    const prettierStdout = await prettierProcess.stdout.readText();
    const prettierStderr = await prettierProcess.stderr.readText();
    await prettierProcess.wait();

    console.log("[generate-code-stream] Prettier output:");
    if (prettierStdout) console.log("[generate-code-stream] Prettier stdout:", prettierStdout);
    if (prettierStderr) console.log("[generate-code-stream] Prettier stderr:", prettierStderr);

    if (prettierStdout || prettierStderr) {
      result += "Prettier output:\n";
      if (prettierStdout) result += prettierStdout;
      if (prettierStderr) result += prettierStderr;
      result += "\n";
    }

    if (process.env.RUN_ESLINT_CHECK === "true") {
      // Run ESLint with default format (human-readable output)
      const eslintProcess = await sandbox.exec([
        "bash",
        "-c",
        `cd ${workingDir} && npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 999999 --no-error-on-unmatched-pattern 2>&1 || true`,
      ]);
      const eslintStdout = await eslintProcess.stdout.readText();
      const eslintStderr = await eslintProcess.stderr.readText();
      await eslintProcess.wait();

      console.log("[generate-code-stream] ESLint output:");
      if (eslintStdout) console.log("[generate-code-stream] ESLint stdout:", eslintStdout);
      if (eslintStderr) console.log("[generate-code-stream] ESLint stderr:", eslintStderr);
      if (!eslintStdout && !eslintStderr) {
        console.log("[generate-code-stream] ESLint: No issues found");
      }
      
      if (eslintStdout || eslintStderr) {
        result += "ESLint output:\n";
        if (eslintStdout) result += eslintStdout;
        if (eslintStderr) result += eslintStderr;
      } else {
        result += "ESLint: No issues found.\n";
      }
    }

    // Truncate if too long (similar to bash command output)
    if (result.length > 30000) {
      result = result.substring(0, 30000) + "\n... (lint output truncated)";
    }

    console.log("[generate-code-stream] Lint check completed. Result length:", result.length, "characters");
    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Lint check encountered an error: ${errorMessage}. Continuing without lint results.`;
  }
}

async function executeWriteFile(
  sandbox: any,
  tool: WriteFileTool,
  workingDir: string
): Promise<string> {
  try {
    const dirPath = dirname(tool.filePath);
    if (dirPath && dirPath !== "/" && dirPath !== ".") {
      const mkdirProcess = await sandbox.exec(["mkdir", "-p", dirPath]);
      await mkdirProcess.wait();
    }

    const file = await sandbox.open(tool.filePath, "w");
    await file.write(new TextEncoder().encode(tool.content));
    await file.close();
    
    let result = `Successfully wrote file ${tool.filePath}`;
    
    // Run lint checks after successful write (only for files in working directory)
    if (tool.filePath.startsWith(workingDir) || tool.filePath.startsWith("/my-app")) {
      try {
        console.log("[generate-code-stream] Triggering lint check after writing file:", tool.filePath);
        const lintResults = await executeLintCheck(sandbox, workingDir);
        result += `\n\n${lintResults}`;
        console.log("[generate-code-stream] Lint check results:", lintResults);
      } catch (lintError) {
        // Don't fail the write operation if lint check fails
        console.error("[generate-code-stream] Lint check failed:", lintError);
        result += `\n\n(Lint check encountered an error, but file was written successfully)`;
      }
    }
    
    return result;
  } catch (error) {
    // Return error message so agent can handle it
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Error writing file ${tool.filePath}: ${errorMessage}. Please check the path and content format.`;
  }
}

// Bash command execution function
async function executeBashCommand(
  sandbox: any,
  tool: BashTool
): Promise<string> {
  try {
    const timeout = tool.timeout || 120000; // Default 2 minutes, max 10 minutes
    const maxTimeout = Math.min(timeout, 600000);
    
    console.log(`[generate-code-stream] Executing bash command: ${tool.command} (timeout: ${maxTimeout}ms)`);
    
    // Execute command using bash -c in the sandbox
    const process = await sandbox.exec(["bash", "-c", tool.command]);
    
    // Read stdout and stderr
    const stdoutPromise = process.stdout.readText();
    const stderrPromise = process.stderr.readText();
    
    // Wait for process to complete with timeout
    const waitPromise = process.wait();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Command timed out")), maxTimeout)
    );
    
    const exitCode = await Promise.race([waitPromise, timeoutPromise]);
    
    const stdout = await stdoutPromise;
    const stderr = await stderrPromise;
    
    // Combine stdout and stderr, truncate if too long
    let output = "";
    if (stdout) output += stdout;
    if (stderr) {
      if (output) output += "\n";
      output += `STDERR: ${stderr}`;
    }
    
    // Truncate if output exceeds 30000 characters
    if (output.length > 30000) {
      output = output.substring(0, 30000) + "\n... (output truncated)";
    }
    
    if (exitCode === 0) {
      return `Command executed successfully:\n${output || "(no output)"}`;
    } else {
      return `Command exited with code ${exitCode}:\n${output || "(no output)"}`;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return `Error executing bash command: ${errorMessage}. Please check the command syntax and try again.`;
  }
}

// Todo management function
async function executeTodoWrite(
  tool: TodoWriteTool,
  todoList: TodoItem[]
): Promise<{ result: string; updatedList: TodoItem[] }> {
  const updatedList = tool.todos;
  // Validate that exactly one task is in_progress
  const inProgressCount = updatedList.filter((todo) => todo.status === "in_progress").length;
  let result = `Todo list updated. ${updatedList.length} items.`;
  if (inProgressCount !== 1 && updatedList.some((todo) => todo.status !== "completed")) {
    result += ` Warning: Expected exactly one task in_progress, found ${inProgressCount}.`;
  }
  return {
    result,
    updatedList,
  };
}

// Execute a single tool (non-array)
export async function executeSingleTool(
  sandbox: any,
  tool: SingleTool,
  workingDir: string,
  todoList: TodoItem[]
): Promise<SingleToolResult> {
  switch (tool.action) {
    case "list_files":
      return { result: await executeListFiles(sandbox, tool) };
    case "read_file":
      return { result: await executeReadFile(sandbox, tool) };
    case "write_file":
      return { result: await executeWriteFile(sandbox, tool, workingDir) };
    case "bash":
      return { result: await executeBashCommand(sandbox, tool) };
    case "todo_write":
      const todoResult = await executeTodoWrite(tool, todoList);
      return { result: todoResult.result, updatedTodoList: todoResult.updatedList };
    default:
      return { result: `Unknown tool action: ${(tool as any).action}` };
  }
}

// Parallel execution function for read operations
export async function executeParallelTools(
  sandbox: any,
  tools: (ListFilesTool | ReadFileTool)[],
  workingDir: string,
  todoList: TodoItem[]
): Promise<string> {
  const results = await Promise.all(
    tools.map(async (tool, index) => {
      const { result } = await executeSingleTool(sandbox, tool, workingDir, todoList);
      return `[${index + 1}] ${result}`;
    })
  );
  return `Results for parallel read:\n${results.join("\n")}`;
}

// Helper function to extract all written files from message state
export function extractFilesFromState(state: Message[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const msg of state) {
    if (
      msg.role === "assistant" &&
      typeof msg.message !== "string" &&
      "action" in msg.message &&
      msg.message.action === "write_file"
    ) {
      files[msg.message.filePath] = msg.message.content;
    }
  }
  return files;
}

export function areAllTodosCompleted(todoList: TodoItem[]): boolean {
  return todoList.length > 0 && todoList.every((todo) => todo.status === "completed");
}

// Helper function to extract tool parameters for display (excluding content for WriteFileTool)
export function extractToolParams(
  tool: FileTools | (ListFilesTool | ReadFileTool)[] | TodoTools
): Record<string, any> {
  if (Array.isArray(tool)) {
    // For arrays, show the count and tool types
    return {
      toolCount: tool.length,
      toolTypes: tool.map(t => t.action),
    };
  } else if (tool.action === "write_file") {
    // For WriteFileTool, exclude content field
    const { content, ...params } = tool as WriteFileTool;
    return params;
  } else {
    // For all other tools, return all fields
    return { ...tool };
  }
}

