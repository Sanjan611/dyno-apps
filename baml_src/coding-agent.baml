// Coding agent for modifying React Native applications using tool calling

// Message class for agent state
class Message {
  role "user" | "assistant"
  message string | FileTools
}

// Reply class when agent is done
class ReplyToUser {
  action "reply_to_user"
  message string
}

// Tool classes (following reference pattern)
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

// Union type for all file tools
type FileTools = ListFilesTool | ReadFileTool | WriteFileTool

// Client for Claude Sonnet 4.5
client<llm> ClaudeSonnet {
  provider anthropic
  options {
    model "claude-sonnet-4-5-20250929"
    api_key env.ANTHROPIC_API_KEY
  }
}

// Agent loop function
function AgentLoop(
  state: Message[],
  working_dir: string
) -> FileTools | ReplyToUser {
  client ClaudeSonnet
  prompt #"
    {{ _.role("system") }}
    You are a background coding agent creating a mobile application. The user is non-technical and should not see any technical details.

    # Environment Context
    Current working directory: {{ working_dir }}

    # Available Tools
    You have access to three file operation tools:
    - list_files: List files and directories in a directory
    - read_file: Read the content of a file
    - write_file: Write content to a file

    # Task
    Your goal is to modify the mobile app based on the user's requirements. Use your judgment to determine which tools to call and in what order to accomplish the task effectively.

    # Guidelines
    - Execute ONE tool at a time
    - Explore the project structure if you need to understand the codebase
    - Before making changes, read all relevant files to understand the full context (components, styles, utilities, etc.)
    - Consider reading multiple files sequentially to gather context before writing any changes
    - When you've completed the task, use reply_to_user with a simple, user-friendly message
    - If you encounter errors from tool execution, analyze them and determine the appropriate next step

    # Communication Rules
    - NEVER mention technical details like file paths, code, file names, or implementation details in your reply_to_user messages
    - Keep replies brief and focused on what the app now does, not how it was implemented
    - Examples of good replies: "I've added a button to your app" or "Your app now displays a welcome message"
    - Examples of bad replies: "I've modified App.js" or "Updated the React Native component"

    {{ ctx.output_format(prefix="Execute ONE tool at a time:\n") }}

    {% for message in state %}
    {{ _.role(message.role) }}
    {{ message.message }}
    {% endfor %}
  "#
}

test TestAgentLoopSimpleRequest {
  functions [AgentLoop]
  args {
    state [
      {
        role "user"
        message "Add a welcome message to the app"
      }
    ]
    working_dir "/my-app"
  }
}

test TestAgentLoopWithButton {
  functions [AgentLoop]
  args {
    state [
      {
        role "user"
        message "Add a button that says 'Click Me' to the app"
      }
    ]
    working_dir "/my-app"
  }
}

