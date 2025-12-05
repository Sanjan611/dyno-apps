import { dirname } from "path";
import type {
  ListFilesTool,
  ReadFileTool,
  WriteFileTool,
  BashTool,
  VerifyExpoServerTool,
  Message,
  FileTools,
  TodoItem,
  TodoWriteTool,
  TodoTools,
} from "@/baml_client/types";
import { WORKING_DIR, CONTENT_LIMITS, TIMEOUTS, LOG_PREFIXES } from "@/lib/constants";

// Type for single (non-array) tools
export type SingleTool = ListFilesTool | ReadFileTool | WriteFileTool | BashTool | TodoWriteTool | VerifyExpoServerTool;

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
    const dirPath = tool.directoryPath;
    
    // Check if directory exists using test -d
    const existsProcess = await sandbox.exec(["test", "-e", dirPath]);
    const existsCode = await existsProcess.wait();
    if (existsCode !== 0) {
      return `Directory not found: ${dirPath}`;
    }
    
    // Check if it's actually a directory
    const isDirProcess = await sandbox.exec(["test", "-d", dirPath]);
    const isDirCode = await isDirProcess.wait();
    if (isDirCode !== 0) {
      return `Not a directory: ${dirPath}`;
    }
    
    // List directory contents with file type indicators
    // Using ls -1 -p to get one item per line with / suffix for directories
    const lsProcess = await sandbox.exec(["ls", "-1", "-p", dirPath]);
    const output = await lsProcess.stdout.readText();
    await lsProcess.wait();
    
    const lines = output.split("\n").filter((line: string) => line.trim());
    
    if (lines.length === 0) {
      return "Empty directory";
    }
    
    const items: string[] = [];
    for (const line of lines) {
      const name = line.trim();
      if (!name) continue;
      
      // ls -p adds trailing / to directories
      if (name.endsWith("/")) {
        items.push(`DIR  ${name.slice(0, -1)}`);
      } else {
        items.push(`FILE ${name}`);
      }
    }
    
    items.sort();
    return items.join("\n");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return `Error listing directory: ${errorMessage}`;
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
    console.log(`${LOG_PREFIXES.CHAT} Running lint check in`, workingDir);

    let result = "Lint check results:\n\n";
    
    // Run Prettier with --write to auto-fix formatting issues
    const prettierProcess = await sandbox.exec([
      "bash",
      "-c",
      `cd ${workingDir} && bunx prettier --write "**/*.{js,jsx,ts,tsx}" 2>&1 || echo "Prettier check completed"`,
    ]);
    const prettierStdout = await prettierProcess.stdout.readText();
    const prettierStderr = await prettierProcess.stderr.readText();
    await prettierProcess.wait();

    console.log(`${LOG_PREFIXES.CHAT} Prettier output:`);
    if (prettierStdout) console.log(`${LOG_PREFIXES.CHAT} Prettier stdout:`, prettierStdout);
    if (prettierStderr) console.log(`${LOG_PREFIXES.CHAT} Prettier stderr:`, prettierStderr);

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
        `cd ${workingDir} && bunx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 999999 --no-error-on-unmatched-pattern 2>&1 || true`,
      ]);
      const eslintStdout = await eslintProcess.stdout.readText();
      const eslintStderr = await eslintProcess.stderr.readText();
      await eslintProcess.wait();

      console.log(`${LOG_PREFIXES.CHAT} ESLint output:`);
      if (eslintStdout) console.log(`${LOG_PREFIXES.CHAT} ESLint stdout:`, eslintStdout);
      if (eslintStderr) console.log(`${LOG_PREFIXES.CHAT} ESLint stderr:`, eslintStderr);
      if (!eslintStdout && !eslintStderr) {
        console.log(`${LOG_PREFIXES.CHAT} ESLint: No issues found`);
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
    if (result.length > CONTENT_LIMITS.LINT_OUTPUT) {
      result = result.substring(0, CONTENT_LIMITS.LINT_OUTPUT) + "\n... (lint output truncated)";
    }

    console.log(`${LOG_PREFIXES.CHAT} Lint check completed. Result length:`, result.length, "characters");
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
    if (tool.filePath.startsWith(workingDir) || tool.filePath.startsWith(WORKING_DIR)) {
      try {
        console.log(`${LOG_PREFIXES.CHAT} Triggering lint check after writing file:`, tool.filePath);
        const lintResults = await executeLintCheck(sandbox, workingDir);
        result += `\n\n${lintResults}`;
        console.log(`${LOG_PREFIXES.CHAT} Lint check results:`, lintResults);
      } catch (lintError) {
        // Don't fail the write operation if lint check fails
        console.error(`${LOG_PREFIXES.CHAT} Lint check failed:`, lintError);
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
    const timeout = tool.timeout || TIMEOUTS.BASH_COMMAND_DEFAULT;
    const maxTimeout = Math.min(timeout, TIMEOUTS.BASH_COMMAND_MAX);
    
    console.log(`${LOG_PREFIXES.CHAT} Executing bash command: ${tool.command} (timeout: ${maxTimeout}ms)`);
    
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
    
    // Truncate if output exceeds limit
    if (output.length > CONTENT_LIMITS.BASH_OUTPUT) {
      output = output.substring(0, CONTENT_LIMITS.BASH_OUTPUT) + "\n... (output truncated)";
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

// Verify Expo server status and check logs for errors
async function executeVerifyExpoServer(
  sandbox: any,
  tool: VerifyExpoServerTool
): Promise<string> {
  let result = "";
  try {
    const tailLines = Math.min(tool.tailLines || 50, 200);

    // Get raw tail of Expo logs
    const logProcess = await sandbox.exec([
      "bash",
      "-c",
      `tail -n ${tailLines} /tmp/expo.log 2>&1`
    ]);
    const logOutput = await logProcess.stdout.readText();
    await logProcess.wait();

    result = logOutput.trim() || "(No log output)";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    result = `Error reading Expo logs: ${errorMessage}`;
  }
  console.log(`${LOG_PREFIXES.CHAT} Expo server logs:`, result);
  return result;
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
    case "verify_expo_server":
      return { result: await executeVerifyExpoServer(sandbox, tool) };
    default:
      return { result: `Unknown tool action: ${(tool as any).action}` };
  }
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
  tool: FileTools | TodoTools
): Record<string, any> {
  if (tool.action === "write_file") {
    // For WriteFileTool, exclude content field
    const { content, ...params } = tool as WriteFileTool;
    return params;
  } else {
    // For all other tools, return all fields
    return { ...tool };
  }
}

