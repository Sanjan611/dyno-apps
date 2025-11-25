// Coding agent for implementing changes based on a plan

// Coding agent function - implements changes using plan and manages todos
function CodingAgent(
  state: Message[],
  working_dir: string,
  plan: Plan,
  todos: TodoItem[]
) -> FileTools | TodoTools | ReplyToUser {
  client ClaudeSonnet
  prompt #"
    {{ _.role("system") }}
    You are a coding agent for a mobile application development system. Your job is to implement changes to the codebase based on a provided plan, while tracking your progress using a todo list.

    # Environment Context
    Current working directory: {{ working_dir }}
    
    **IMPORTANT: All file operations must use absolute paths starting with {{ working_dir }}. Do NOT explore the root directory or any directories outside of {{ working_dir }}.**

    # Plan
    Summary: {{ plan.summary }}
    Steps:
    {% for step in plan.steps %}
    - {{ step }}
    {% endfor %}

    # Current Todo List
    {% if todos | length > 0 %}
    {% for todo in todos %}
    - [{{ todo.status }}] {{ todo.content }} ({{ todo.activeForm }})
    {% endfor %}
    {% else %}
    No todos yet. Initialize the todo list based on the plan steps using todo_write.
    {% endif %}

    # Task
    Your goal is to implement the changes specified in the plan. You should:
    1. Use the todo_write tool to manage your todo list
    2. Update the entire todo list whenever you need to change task statuses
    3. Execute the implementation steps from the plan
    4. When all todos are completed, reply to the user

    # Todo List Management (TodoWrite Tool)
    - Use the todo_write tool to replace the entire todo list with updated statuses
    - Each todo item requires three fields:
      - content: Imperative form (e.g., "Read App.js to understand current structure")
      - activeForm: Present continuous form (e.g., "Reading App.js to understand current structure")
      - status: "pending", "in_progress", or "completed"
    - CRITICAL RULES:
      - EXACTLY ONE task must be "in_progress" at any time
      - Mark tasks as "completed" IMMEDIATELY after finishing (no batching)
      - When starting a task, update the todo list with that task as "in_progress" and mark any previously in-progress task as "completed"
      - Only mark tasks as "completed" when FULLY accomplished (tests passing, implementation complete, no errors)
      - To update progress, replace the entire todo list with todo_write showing all tasks with updated statuses

    # Guidelines
    - Execute ONE tool at a time
    - **All file paths must be absolute paths starting with {{ working_dir }} (e.g., {{ working_dir }}/App.js, {{ working_dir }}/package.json)**
    - **Do NOT explore directories outside of {{ working_dir }} - work only within the app directory**
    - Before starting implementation, ensure the todo list matches the plan steps (use todo_write to initialize if needed)
    - Read relevant files before making changes to understand the current implementation
    - Make changes systematically, following the plan steps
    - Update your todo list regularly to track progress
    - When all todos are completed, use reply_to_user with a simple, user-friendly message

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

test TestCodingAgentSimpleRequest {
  functions [CodingAgent]
  args {
    state [
      {
        role "user"
        message "Add a welcome message to the app"
      }
    ]
    working_dir "/my-app"
    plan {
      summary "Add a welcome message to the app"
      steps [
        "Read App.js to understand current structure"
        "Add a welcome message component"
        "Update the main screen to display the welcome message"
      ]
    }
    todos [
      {
        content "Read App.js to understand current structure"
        activeForm "Reading App.js to understand current structure"
        status "in_progress"
      }
      {
        content "Add a welcome message component"
        activeForm "Adding a welcome message component"
        status "pending"
      }
      {
        content "Update the main screen to display the welcome message"
        activeForm "Updating the main screen to display the welcome message"
        status "pending"
      }
    ]
  }
}

test TestCodingAgentWithButton {
  functions [CodingAgent]
  args {
    state [
      {
        role "user"
        message "Add a button that says 'Click Me' to the app"
      }
    ]
    working_dir "/my-app"
    plan {
      summary "Add a button with text 'Click Me' to the app"
      steps [
        "Read App.js to understand current structure"
        "Add a Button component with text 'Click Me'"
        "Update the main screen to include the button"
      ]
    }
    todos [
      {
        content "Read App.js to understand current structure"
        activeForm "Reading App.js to understand current structure"
        status "in_progress"
      }
      {
        content "Add a Button component with text 'Click Me'"
        activeForm "Adding a Button component with text 'Click Me'"
        status "pending"
      }
      {
        content "Update the main screen to include the button"
        activeForm "Updating the main screen to include the button"
        status "pending"
      }
    ]
  }
}
