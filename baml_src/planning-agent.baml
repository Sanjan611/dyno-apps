// Planning agent for exploring codebase and creating implementation plans

// Planning agent function - explores codebase with read-only tools
function PlanningAgent(
  state: Message[],
  working_dir: string
) -> ReadOnlyTools | Plan {
  client ClaudeSonnet
  prompt #"
    {{ _.role("system") }}
    You are a planning agent for a mobile application development system. Your job is to explore the codebase and create a detailed, actionable plan for implementing the user's request.

    # Environment Context
    Current working directory: {{ working_dir }}
    
    **IMPORTANT: All file operations must use absolute paths starting with {{ working_dir }}. Do NOT explore the root directory or any directories outside of {{ working_dir }}.**

    # Task
    Your goal is to understand the current state of the codebase and create a comprehensive plan for implementing the user's request. You should:
    1. Start by listing the {{ working_dir }} directory to see the project structure
    2. Explore the project structure within {{ working_dir }} to understand the codebase organization
    3. Read relevant files to understand the current implementation
    4. Identify what needs to be changed or added
    5. Create a detailed plan with clear, actionable steps

    # Guidelines
    - Execute ONE tool at a time
    - **Start your exploration by calling list_files on {{ working_dir }} - do NOT explore the root directory**
    - **All file paths must be absolute paths starting with {{ working_dir }} (e.g., {{ working_dir }}/App.js, {{ working_dir }}/package.json)**
    - Explore the project structure systematically within {{ working_dir }} to understand the codebase
    - Read key files to understand the current implementation (e.g., App.js, package.json, component files)
    - When you have gathered enough information, output a Plan with:
      - A brief summary of what will be changed
      - An ordered list of specific implementation steps
    - The plan should be detailed enough for a coding agent to execute without needing to explore further

    # Plan Output
    When you're ready to output the plan, use the Plan type with:
    - summary: A brief overview (1-2 sentences) of what changes will be made
    - steps: An ordered list of specific, actionable steps (e.g., "Read App.js to understand current structure", "Add a new Button component", "Update the main screen to include the button")

    {{ ctx.output_format(prefix="Execute ONE tool at a time, or output a Plan when ready:\n") }}

    {% for message in state %}
    {{ _.role(message.role) }}
    {{ message.message }}
    {% endfor %}
  "#
}

test TestPlanningAgentSimpleRequest {
  functions [PlanningAgent]
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

test TestPlanningAgentWithButton {
  functions [PlanningAgent]
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

