---
description: Research the codebase to understand data flows, architecture, and relevant files
model: opus
---

# Research Codebase

You are tasked with comprehensive codebase research. Your goal is to deeply understand how the codebase works based on the user's research question.

## Critical Constraint

Your sole responsibility is **documenting the codebase as it currently exists**:

- DO NOT suggest improvements or changes unless the user explicitly asks
- DO NOT perform root cause analysis unless the user explicitly asks
- DO NOT propose future enhancements unless the user explicitly asks
- ONLY describe what exists, where it exists, how it works, and how components interact

## Research Question

$ARGUMENTS

## Process

### 1. Analyze the Research Question

Break down the research query into composable areas:
- Identify key concepts, components, or features mentioned
- Determine what aspects need investigation (data flow, architecture, implementation details)
- List the types of files likely involved (API routes, components, utilities, types, etc.)

### 2. Explore the Codebase

Use a single Explore agent (Task tool with `subagent_type=Explore`) to investigate the research question. This codebase is small enough that a single thorough agent is more efficient than multiple parallel agents, which tend to duplicate work and consume extra tokens.

**Areas to cover in your exploration:**

- **Entry Points**: Where the feature/concept is initiated (API routes, UI components, event handlers)
- **Data Flow**: How data moves through the system (props, state, API calls, database queries)
- **Type Definitions**: Relevant TypeScript types, interfaces, and schemas
- **Implementation**: Core logic and business rules
- **Integrations**: How components connect to external services (Supabase, Modal, GitHub, etc.)
- **Configuration**: Relevant constants, environment variables, and settings

Provide the agent with a clear, comprehensive prompt covering all relevant aspects.

### 3. Synthesize Findings

After exploration completes, compile the results into a coherent understanding:

- Identify the complete data flow from start to finish
- Map out component relationships and dependencies
- Note any patterns or architectural decisions
- Highlight key files and their roles

### 4. Present Research Document

Structure your findings as follows:

```markdown
## Research Summary

[2-3 sentence overview of what you discovered]

## Architecture Overview

[High-level description of how the system/feature is structured]

## Data Flow

[Step-by-step walkthrough of how data moves through the system]

1. **Entry Point**: Where it starts
2. **Processing**: What happens to the data
3. **Output**: Where it ends up

## Key Files

| File | Purpose | Key Functions/Components |
|------|---------|-------------------------|
| path/to/file.ts:line | Description | `functionName`, `ComponentName` |

## Component Relationships

[Describe how different parts interact, with file:line references]

## External Integrations

[If applicable: APIs, services, databases involved]

## Code References

[Include specific file:line references for important code sections]
```

## Guidelines

- **Always use file:line format** for code references (e.g., `lib/server/modal.ts:45`)
- **Read files directly** when you need to understand specific implementations
- **Use Grep** for finding specific patterns, function calls, or string literals
- **Use Glob** for finding files by naming patterns
- **Prioritize understanding over completeness** - focus on the most relevant aspects first
- **Follow imports and function calls** to trace the complete flow
- **Document cross-component connections** explicitly
- **Include type information** when it helps clarify data structures

## Example Research Questions

- "How does SSE streaming work from the coding agent to the chat panel?"
- "What happens when a user creates a new project?"
- "How are Modal sandboxes managed throughout their lifecycle?"
- "Where is authentication checked and how does it protect routes?"
