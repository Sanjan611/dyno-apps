// Message class for agent state
class Message {
  role "user" | "assistant" | "tool"
  message string | AgentTools | ReplyToUser
}

// File operation tools
class ListFilesTool {
  action "list_files" @description("List files and directories in a given directory path")
  directoryPath string @description("Path to the directory to list")
}

class ReadFileTool {
  action "read_file" @description("Read file contents with optional line range. Returns cat -n style output with line numbers.")
  filePath string @description("Absolute path to the file to read")
  offset int? @description("Starting line number (1-indexed). Defaults to 1.")
  limit int? @description("Number of lines to read. Defaults to 2000.")
}

class ReadFilesTool {
  action "read_files" @description("Read multiple file contents")
  tools ReadFileTool[]
}

class WriteFileTool {
  action "write_file" @description("Write content to a file")
  filePath string @description("Path to the file to write")
  content string @description("The content to write to the file")
}

class EditTool {
  action "edit_file" @description("Perform surgical string replacement in a file. Requires exact string match.")
  filePath string @description("Absolute path to the file to edit")
  oldString string @description("The exact text to replace (must be unique in file unless replaceAll is true)")
  newString string @description("The replacement text")
  replaceAll bool? @description("Replace all occurrences instead of requiring uniqueness. Default: false")
}

class BashTool {
  action "bash" @description(#"
    Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.

    Before executing the command, please follow these steps:

    1. Directory Verification:
       - If the command will create new directories or files, first use the list_files tool to verify the parent directory exists and is the correct location
       - For example, before running "mkdir foo/bar", first use list_files to check that "foo" exists and is the intended parent directory

    2. Command Execution:
       - Always quote file paths that contain spaces with double quotes (e.g., cd "path with spaces/file.txt")
       - Examples of proper quoting:
         - cd "/Users/name/My Documents" (correct)
         - cd /Users/name/My Documents (incorrect - will fail)
         - python "/path/with spaces/script.py" (correct)
         - python /path/with spaces/script.py (incorrect - will fail)
       - After ensuring proper quoting, execute the command.
       - Capture the output of the command.

    Usage notes:
      - The command argument is required.
      - You can specify an optional timeout in milliseconds (up to 600000ms / 10 minutes). If not specified, commands will timeout after 120000ms (2 minutes).
      - It is very helpful if you write a clear, concise description of what this command does in 5-10 words.
      - If the output exceeds 30000 characters, output will be truncated before being returned to you.
      - VERY IMPORTANT: You MUST avoid using search commands like `find` and `grep` in bash. Instead use list_files and read_file to search. You MUST avoid read tools like `cat`, `head`, `tail`, and `ls`, and use read_file and list_files to read files.
      - When issuing multiple commands, use the ';' or '&&' operator to separate them. DO NOT use newlines (newlines are ok in quoted strings).
      - **CRITICAL for Expo packages**: When installing Expo libraries, you MUST use `bun expo install <package-name>`. Never use `npm install` or `bun install` for Expo packages. For example: `bun expo install expo-audio` (correct) vs `npm install expo-audio` (incorrect).
  "#)
  command string @description("The command to execute")
  timeout int? @description("Optional timeout in milliseconds (max 600000)")
  description string? @description("Clear, concise description of what this command does in 5-10 words")
}

class VerifyExpoServerTool {
  action "verify_expo_server" @description(#"
    Checks the Expo server logs to verify the server is running correctly and identify any errors or issues.
    
    **IMPORTANT: You MUST use this tool before replying to the user** after making any code changes.
    This ensures the app compiled successfully and the user will see the updated preview.
    
    Use this tool:
    - ALWAYS before calling reply_to_user (after completing all code changes)
    - When the app preview is not loading or showing errors
    - After making significant changes to verify hot-reload worked
    - When the user reports the preview is broken or not updating
    
    Returns:
    - Server status (running/not running)
    - Recent log output with errors/warnings highlighted
    - Port status (whether port 19006 is listening)
    - Compilation status
  "#)
  tailLines int? @description("Number of recent log lines to retrieve (default: 50, max: 200)")
}

// Union type for read-only tools
type ReadOnlyTools = ListFilesTool | ReadFileTool | ReadFilesTool

// Union type for all file tools (used by coding agent)
type FileTools = ListFilesTool | ReadFileTool | ReadFilesTool | WriteFileTool | EditTool | BashTool | VerifyExpoServerTool

// Todo management classes
class TodoItem {
  id string @description("Unique identifier for this todo (e.g., 'setup-auth', 'add-button')")
  content string @description("Imperative form of the task (e.g., 'Run tests')")
  activeForm string @description("Present continuous form for UI display (e.g., 'Running tests')")
  status "pending" | "in_progress" | "completed" | "cancelled"
}

class TodoWriteTool {
  action "todo_write" @description("Create and manage structured task lists for tracking progress. Replace the entire todo list with a new set of todos.")
  todos TodoItem[]
}

// Union type for todo tools
type TodoTools = TodoWriteTool

// Reply class when agent is done
class ReplyToUser {
  action "reply_to_user"
  message string
}

// Union type for all agent tools (file tools, todo tools, and replies)
type AgentTools = FileTools | TodoTools

