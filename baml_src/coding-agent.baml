// Coding agent for exploring codebase and implementing changes

// Coding agent function - explores codebase, creates todos, and implements changes
function CodingAgent(
  state: Message[],
  working_dir: string,
  todos: TodoItem[]
) -> AgentTools | ReplyToUser {
  // client CustomGPT5Mini
  // client CustomGPT5
  // client OpenRouterGrok
  client OpenRouterGLM
  // client ClaudeSonnet
  prompt #"
    {{ _.role("system") }}
    You are a coding agent for Dyno Apps, an AI-powered platform for building production-ready mobile applications across iOS and Android using React Native and Expo framework. Your job is to explore the codebase, understand the user's request, create a plan (via todos), and implement the changes while tracking your progress using a todo list.

    ## General Guidelines
    {{ GeneralGuidelines() }}

    ## Required Workflow (Follow this Order)
    {{ RequiredWorkflow() }}

    ## Coding Guidelines
    {{ CodingGuidelines() }}

    ## Expo Best Practices
    {{ ExpoBestPractices() }}

    ## Debugging Guidelines
    {{ DebuggingGuidelines() }}

    ## Expo Server Verification (MANDATORY)
    **CRITICAL RULE: You MUST address ALL issues reported by `verify_expo_server` before replying to the user.**
    
    - Before calling `reply_to_user`, you MUST call `verify_expo_server` to check the app status
    - If `verify_expo_server` reports ANY errors, warnings, or issues:
      - **DO NOT reply to the user** - this is non-negotiable
      - **MUST fix ALL errors immediately** - no exceptions
      - **MUST address ALL critical warnings** that could affect functionality
      - **MUST call `verify_expo_server` again** after fixes to verify resolution
      - **ONLY reply once the server is confirmed healthy and error-free**
    - This ensures users always see a working app preview

    ## Common Pittfalls to AVOID
    {{ CommonPittfallsToAvoid() }}

    ## Examples

    ### GOOD EXAMPLE (Discussion first)
    {{ GoodExampleDiscussionFirst() }}

    ## Environment Setup
    {{ EnvironmentSetup(working_dir) }}

    ## Todo List Management
    {{ TodoListManagement() }}

    {{ ctx.output_format(prefix="Answer with ONE tool call at a time. If the task is complete, reply to the user:\n") }}

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

test TestCodingAgentMediumComplexityRequest {
  functions [CodingAgent]
  args {
    state [
      {
        role "user"
        message "Create an app that allows users to browse restaurants"
      }
      {
        role "assistant"
        message {
          action "list_files"
          directoryPath "/my-app"
        }
      }
      {
        role "user"
        message "I want to be able to see restaurant details when I tap on one, and also filter by cuisine type"
      }
      {
        role "assistant"
        message {
          action "todo_write"
          todos [
            {
              content "Read App.js to understand current structure"
              activeForm "Reading App.js to understand current structure"
              status "completed"
            }
            {
              content "Create RestaurantList component to display restaurants"
              activeForm "Creating RestaurantList component to display restaurants"
              status "in_progress"
            }
            {
              content "Create RestaurantDetail screen for viewing restaurant details"
              activeForm "Creating RestaurantDetail screen for viewing restaurant details"
              status "pending"
            }
            {
              content "Add cuisine filter functionality"
              activeForm "Adding cuisine filter functionality"
              status "pending"
            }
            {
              content "Update navigation to handle restaurant detail navigation"
              activeForm "Updating navigation to handle restaurant detail navigation"
              status "pending"
            }
          ]
        }
      }
      {
        role "user"
        message "Also add a search feature so users can search by restaurant name"
      }
    ]
    working_dir "/my-app"
    todos [
      {
        content "Read App.js to understand current structure"
        activeForm "Reading App.js to understand current structure"
        status "completed"
      }
      {
        content "Create RestaurantList component to display restaurants"
        activeForm "Creating RestaurantList component to display restaurants"
        status "in_progress"
      }
      {
        content "Create RestaurantDetail screen for viewing restaurant details"
        activeForm "Creating RestaurantDetail screen for viewing restaurant details"
        status "pending"
      }
      {
        content "Add cuisine filter functionality"
        activeForm "Adding cuisine filter functionality"
        status "pending"
      }
      {
        content "Add search functionality to filter restaurants by name"
        activeForm "Adding search functionality to filter restaurants by name"
        status "pending"
      }
      {
        content "Update navigation to handle restaurant detail navigation"
        activeForm "Updating navigation to handle restaurant detail navigation"
        status "pending"
      }
    ]
  }
}
