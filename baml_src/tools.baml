// Shared tool definitions for both planning and coding agents

// Message class for agent state
class Message {
  role "user" | "assistant"
  message string | ReadOnlyTools | ParallelReadTools | FileTools | TodoTools
}

// File operation tools
class ListFilesTool {
  action "list_files" @description("List files and directories in a given directory path")
  directoryPath string @description("Path to the directory to list")
}

class ReadFileTool {
  action "read_file" @description("Read the content of a file")
  filePath string @description("Path to the file to read")
}

class WriteFileTool {
  action "write_file" @description("Write content to a file")
  filePath string @description("Path to the file to write")
  content string @description("The content to write to the file")
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
      - VERY IMPORTANT: You MUST avoid using search commands like `find` and `grep`. Instead use list_files and read_file to search. You MUST avoid read tools like `cat`, `head`, `tail`, and `ls`, and use read_file and list_files to read files.
      - When issuing multiple commands, use the ';' or '&&' operator to separate them. DO NOT use newlines (newlines are ok in quoted strings).
      - Try to maintain your current working directory throughout the session by using absolute paths and avoiding usage of `cd`. You may use `cd` if the User explicitly requests it.
  "#)
  command string @description("The command to execute")
  timeout int? @description("Optional timeout in milliseconds (max 600000)")
  description string? @description("Clear, concise description of what this command does in 5-10 words")
}

// Parallel execution wrapper for read-only operations
class ParallelReadTools {
  action "parallel_read" @description("Execute multiple read operations in parallel")
  tools (ListFilesTool | ReadFileTool)[]
}

// Union type for read-only tools (used by planning agent)
type ReadOnlyTools = ListFilesTool | ReadFileTool

// Planning agent can use parallel reads
type ReadOnlyToolsOrParallel = ReadOnlyTools | ParallelReadTools

// Union type for all file tools (used by coding agent)
type FileTools = ListFilesTool | ReadFileTool | WriteFileTool | BashTool

// Coding agent can use parallel reads (writes stay sequential)
type FileToolsOrParallel = FileTools | ParallelReadTools

// Plan class for planning agent output
class Plan {
  summary string @description("Brief overview of changes to be made")
  steps string[] @description("Ordered list of implementation steps")
}

// Todo management classes
class TodoItem {
  content string @description("Imperative form of the task (e.g., 'Run tests')")
  activeForm string @description("Present continuous form of the task (e.g., 'Running tests')")
  status "pending" | "in_progress" | "completed"
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

