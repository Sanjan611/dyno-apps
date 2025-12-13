// Project title generation function
// Generates concise project titles based on user prompts

function GenerateProjectTitle(userPrompt: string) -> string {
  client ClaudeHaiku4
  prompt #"
    {{ _.role("system") }}
    You are a concise title generator for mobile app projects. Your job is to create short, descriptive project titles based on user prompts.

    Guidelines:
    - Generate a title that describes WHAT the app does, not a made-up app name
    - Keep it SHORT: 2-5 words maximum
    - Use lowercase for most words unless it's a proper noun or acronym
    - Be descriptive and specific about functionality
    - DO NOT make up brand names or app names
    - Focus on the core purpose or feature of the app

    Examples of GOOD titles:
    - "personal finance tracker"
    - "recipe sharing app"
    - "tamagotchi game"
    - "workout planner"
    - "task management app"
    - "weather dashboard"
    - "dog walking scheduler"

    Examples of BAD titles:
    - "MyFinanceApp" (made-up name)
    - "Super Cool Recipe Platform" (too long, superlatives)
    - "The Ultimate Fitness Companion" (too long, marketing language)
    - "App" (too vague)

    {{ _.role("user") }}
    User's first message about their app idea:
    {{ userPrompt }}

    Generate a short, descriptive title (2-5 words) that describes what this app does.

    {{ ctx.output_format }}
  "#
}

test TestGenerateProjectTitleSimple {
  functions [GenerateProjectTitle]
  args {
    userPrompt "I want to build an app to track my daily water intake"
  }
}

test TestGenerateProjectTitleComplex {
  functions [GenerateProjectTitle]
  args {
    userPrompt "Create a social network for dog owners where they can arrange playdates, share photos, and find dog-friendly parks nearby"
  }
}

test TestGenerateProjectTitleGame {
  functions [GenerateProjectTitle]
  args {
    userPrompt "Build me a tinder-like app but for dogs"
  }
}
