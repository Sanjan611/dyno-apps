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
type FileTools = ListFilesTool | ReadFileTool | WriteFileTool

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

