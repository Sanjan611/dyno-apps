# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup
```bash
pnpm install              # Install dependencies
pnpm baml:generate        # Generate BAML client (required before build)
```

### Development
```bash
pnpm dev                  # Start Next.js dev server with Turbopack
pnpm baml:check           # Validate BAML definitions
pnpm baml:test            # Run BAML tests (uses .env.local)
```

### Build & Deploy
```bash
pnpm build                # Runs baml:generate then next build
pnpm start                # Start production server
pnpm lint                 # Run ESLint
```

### Database
```bash
supabase db push          # Apply migrations to database
```

## Architecture Overview

### AI Agent System (BAML)

The core of the application is a single autonomous coding agent defined in BAML:

**Agent Location:** `baml_src/coding-agent.baml`
- Function: `CodingAgent(state, working_dir, todos)`
- Client: `GLMWithSonnetFallback` (Z-AI GLM 4.6 with Claude Sonnet 4.5 fallback)
- The agent explores codebases, plans work via todos, and implements changes autonomously

**Tool System:**
- `ListFilesTool` - Directory exploration (bash ls)
- `ReadFileTool` - Read files (batch-optimized for parallel reads)
- `WriteFileTool` - Write files with validation
- `BashTool` - Execute commands with configurable timeouts
- `VerifyExpoServerTool` - Check Expo compilation status
- `TodoWriteTool` - Progress tracking with structured todo lists

**Orchestration:** `lib/server/coding-agent.ts`
- Retry loop with max 3 attempts for validation errors
- Tool execution via `executeToolRequest()` in `lib/server/tool-executors.ts`
- SSE streaming for real-time progress updates to frontend
- Parallel file reads are batched for efficiency

**Prompt System:** `baml_src/shared-prompts.baml`
- Modular reusable prompts: `EnvironmentSetup()`, `ExpoBestPractices()`, `ComponentExamples()`, etc.
- Include these in agent prompts using `{{ PromptName() }}`

### Modal Sandbox Architecture

**Location:** `lib/server/modal.ts`

Each project runs in an isolated Modal sandbox with smart lifecycle management:

1. **On-Demand Creation:** Sandboxes are created when projects are opened, not at project creation
2. **In-Memory Storage:** Sandboxes use in-memory file storage for fast code execution
3. **Smart Reuse:** Existing healthy sandboxes are reused instead of creating new ones
4. **Node Image Caching:** Pre-built Node 20 image with Expo CLI and git installed
5. **Port Exposure:** Port 19006 exposed for Expo web preview via tunnel URLs

**Key Constants:** `lib/constants.ts`
- `SANDBOX_WORKING_DIR = "/root/my-app"` - Full path to app directory in sandbox
- `EXPO_PORT = 19006` - Expo web server port
- Timeout configurations for tunnel, Expo init, bash commands, etc.

**Lifecycle:**
- Create: `POST /api/projects/[id]/sandbox` (creates or reuses sandbox)
- Health: `GET /api/projects/[id]/sandbox/health` (checks process, port, tunnel)
- Logs: `GET /api/projects/[id]/sandbox/logs` (Expo and system logs)
- Delete: `DELETE /api/projects/[id]/sandbox` (terminates sandbox)

### GitHub Integration

**Location:** `lib/server/github.ts`

- **Automatic Repository Creation:** Each project gets a private GitHub repo in `GITHUB_ORG_NAME`
- **Repository Naming:** `dyno-apps-{projectId}`
- **Rollback Mechanism:** If GitHub repo creation fails during project creation, the project is deleted
- **Non-Blocking Deletion:** When deleting projects, GitHub repo deletion errors are logged but don't fail the operation
- **Cloning in Sandboxes:** Repositories are cloned into sandboxes during Expo initialization

### API Route Structure

All routes follow RESTful conventions with nested resources:

**Projects:**
- `GET /api/projects` - List all user projects (RLS-filtered)
- `POST /api/projects` - Create project + GitHub repo (with rollback)
- `PATCH /api/projects` - Update project title
- `DELETE /api/projects/[id]` - Delete project, sandbox, and GitHub repo

**Sandboxes (nested under projects):**
- `POST /api/projects/[id]/sandbox` - Create/reuse sandbox
- `GET /api/projects/[id]/sandbox/health` - Health check
- `GET /api/projects/[id]/sandbox/logs` - Fetch logs

**Code Generation:**
- `POST /api/projects/[id]/chat` - SSE streaming endpoint for agent code generation
  - Uses `export const dynamic = 'force-dynamic'` for streaming
  - Returns Server-Sent Events (SSE) with progress updates
  - Event types: `status`, `coding_iteration`, `todo_update`, `complete`, `error`

**Expo Initialization:**
- `POST /api/init-expo` - Initialize Expo app in sandbox (runs `bun create expo-app`)

### Database Schema (Supabase)

**Table:** `public.projects`

```sql
id                  UUID PRIMARY KEY
title               TEXT NOT NULL
description         TEXT
repository_url      TEXT              -- GitHub repository URL
current_sandbox_id  TEXT              -- Modal sandbox ID
user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ       -- Auto-updated via trigger
```

**Row-Level Security (RLS):** Users can only access their own projects via `user_id` filtering

**Index:** `projects_user_id_idx` on `(user_id, updated_at DESC)` for fast queries

**Key Files:**
- Queries: `lib/server/projectStore.ts`
- Migrations: `supabase/migrations/`

### Frontend State Management

**Zustand Store:** `lib/stores/builder-store.ts`

The builder store holds the current project/sandbox session state. Only user preferences are persisted to localStorage:

```typescript
// PERSISTED (user preferences)
{
  currentMode: MessageMode  // 'ask' | 'build'
}

// NOT PERSISTED (set from route/runtime)
{
  projectName: string
  projectId: string | null
  sandboxId: string | null
  previewUrl: string | null
  sandboxHealthStatus: 'unknown' | 'healthy' | 'unhealthy' | 'not_found'
  sandboxStarted: boolean
  messages: StoreMessage[]
  modifiedFiles: ModifiedFile[]
  lastActivity: Date | null
}
```

**URL as Source of Truth:** The builder route is `/builder/[projectId]`. The project ID comes from the URL, not from persisted state. This prevents "sticky project" bugs when navigating between projects.

**Custom Persistence:** `lib/stores/persist.ts` - localStorage adapter with Date serialization

**Key Hooks:**
- `useSandboxStartup` - Sandbox health check, creation, and Expo initialization
- `useCodeGeneration` - SSE streaming for AI code generation

### Authentication Flow

**Middleware:** `middleware.ts`
- Protects `/builder` and `/project-gallery` routes
- Redirects unauthenticated users to `/login?redirect={path}`
- Redirects authenticated users away from `/login` and `/signup`

**Beta Access:** `app/api/auth/signup/route.ts`
- Requires approval via waitlist system (users must be approved before signing up)
- Returns 403 for unapproved or pending emails

**Supabase Integration:**
- Client: `lib/supabase/client.ts` (browser)
- Server: `lib/supabase/server.ts` (server-side with cookie handling)

### Email & Feedback System

**Location:** `lib/server/email.ts`

User feedback is collected via a floating button and sent via Resend:

- **Floating Button:** `components/feedback/FeedbackButton.tsx` - Only visible to authenticated users
- **Modal Form:** `components/feedback/FeedbackModal.tsx` - Collects email, feedback type (bug/feature/general), and message
- **API Endpoint:** `POST /api/feedback` - Protected by `withAuth` middleware
- **Email Service:** Uses Resend API with lazy client initialization (to avoid build-time errors)

**Resend Setup:**
1. Sign up at https://resend.com
2. Verify your domain at https://resend.com/domains (required to send emails to users)
3. Generate API key with "Send access"
4. Set environment variables:
   - `RESEND_API_KEY` - Your API key
   - `EMAIL_FROM` - e.g., "Dyno Apps <hello@yourdomain.com>" (must use verified domain)
   - `FEEDBACK_EMAIL` - Email to receive user feedback

Note: The testing domain (`onboarding@resend.dev`) only allows sending to your own email address.

## Key Patterns to Follow

### BAML Agent Development

When modifying the agent:

1. **Always include `{{ ctx.output_format }}`** in prompts so the LLM knows the expected output format
2. **Use shared prompts** from `shared-prompts.baml` via `{{ PromptName() }}`
3. **Don't repeat schema fields** in prompts - they're auto-included with `{{ ctx.output_format }}`
4. **Use `{{ _.role("user") }}` tags** to demarcate user input sections
5. **Run `pnpm baml:check`** after editing BAML files to validate syntax
6. **Run `pnpm baml:generate`** to regenerate TypeScript client after BAML changes

See `.cursor/rules/baml.mdc` for complete BAML syntax rules.

### Tool Execution

When adding new tools:

1. Define the tool class in `baml_src/tools.baml`
2. Add it to the appropriate union type (`FileTools`, `ReadOnlyTools`, etc.)
3. Implement executor in `lib/server/tool-executors.ts`
4. Handle errors gracefully and return user-friendly messages
5. Consider timeout requirements (use constants from `lib/constants.ts`)

### SSE Streaming

When working with SSE endpoints:

1. Use `export const dynamic = 'force-dynamic'` in route files
2. Set proper headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
3. Send keepalive comments every 15 seconds: `: keepalive\n\n`
4. Format events as: `data: ${JSON.stringify(payload)}\n\n`
5. Handle errors by sending `{type: "error", error: message}` before closing stream

### UI Patterns

When building scrollable containers:

1. **Always add `overflow-auto`** to containers that may have dynamic or expandable content
2. **Avoid `items-center` on scrollable containers** - when content overflows, centering causes the top to be cut off and unscrollable. Instead:
   - Use `items-start` on the container
   - Add `my-auto` to the inner content for vertical centering when there's space
3. **Example pattern for centered content that may overflow:**
   ```tsx
   // Container: items-start + overflow-auto
   <div className="flex items-start justify-center overflow-auto h-full">
     // Content: my-auto for centering when space available
     <div className="my-auto">
       {/* Content that may expand */}
     </div>
   </div>
   ```

### Modal Sandbox Operations

When interacting with sandboxes:

1. **Always check sandbox health** before operations via `/sandbox/health`
2. **Use idempotent operations** - handle `NotFoundError` gracefully
3. **Batch file reads** in parallel when possible (see `executeToolRequest()`)
4. **Respect timeouts** - bash commands have 2-minute default, 10-minute max
5. **Working directory is `/my-app`** - all Expo project files live here
6. **In-memory storage** - sandboxes use ephemeral in-memory file storage

### Project Initialization Flow

The correct sequence for new projects:

1. User clicks "New Project" in gallery
2. `POST /api/projects` creates project in Supabase + GitHub repo
3. Navigate to `/builder/[projectId]` (project ID in URL)
4. Builder page loads project details from API
5. `useSandboxStartup` auto-starts: checks health, creates sandbox, inits Expo
6. User sends first message
7. `POST /api/projects/[id]/chat` streams code generation

**Important:** The URL `/builder/[projectId]` is the source of truth for project identity. Projects must exist before navigating to the builder page. Visiting `/builder` without a project ID returns 404.

### Error Handling

- **GitHub failures during project creation:** Rollback by deleting the project
- **Sandbox creation failures:** Return error, don't create project record
- **BAML validation errors:** Retry up to 3 times with exponential backoff
- **Tool execution errors:** Stream to client via SSE, don't crash agent loop
- **Timeout errors:** Use configured timeouts from `lib/constants.ts`

## Environment Variables Reference

**Required:**
- `ANTHROPIC_API_KEY` - Claude Sonnet fallback
- `OPENROUTER_API_KEY` - GLM 4.6 primary model
- `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` - Modal sandbox API
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase
- `ADMIN_EMAILS` - Comma-separated admin emails for waitlist management
- `GITHUB_ORG_NAME` + `GITHUB_PAT` - GitHub org and personal access token

**Optional (Email/Feedback):**
- `RESEND_API_KEY` - Resend API key for sending feedback emails
- `FEEDBACK_EMAIL` - Email address to receive user feedback
- `EMAIL_FROM` - Sender address for emails (e.g., "Dyno Apps <hello@yourdomain.com>"). **Required for sending to non-owner emails** - must use a verified domain from https://resend.com/domains

**Optional (Observability):**
- `BOUNDARY_API_KEY` - Boundary Studio for BAML LLM call tracing

**Important:**
- Never use Supabase secret key client-side - only use `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GITHUB_PAT` must have `repo` permissions for the organization
- Keep server-only vars (`MODAL_TOKEN_SECRET`, `GITHUB_PAT`, `ANTHROPIC_API_KEY`) out of client code
- **When adding/changing environment variables, always update `.env.local.example`** to keep it in sync

## Common Troubleshooting

**BAML generation fails:**
```bash
pnpm baml:check  # Validate syntax first
pnpm baml:generate  # Regenerate client
```

**Sandbox not responding:**
- Check health: `GET /api/projects/[id]/sandbox/health`
- View logs: `GET /api/projects/[id]/sandbox/logs`
- Recreate sandbox: `DELETE` then `POST /api/projects/[id]/sandbox`

**Database migrations:**
```bash
supabase db push  # Apply pending migrations
```

**SSE stream hangs:**
- Verify `dynamic = 'force-dynamic'` is set in route
- Check keepalive comments are sent every 15s
- Ensure proper event formatting: `data: {...}\n\n`


<!-- TRIGGER.DEV basic START -->
# Trigger.dev Basic Tasks (v4)

**MUST use `@trigger.dev/sdk`, NEVER `client.defineJob`**

## Basic Task

```ts
import { task } from "@trigger.dev/sdk";

export const processData = task({
  id: "process-data",
  retry: {
    maxAttempts: 10,
    factor: 1.8,
    minTimeoutInMs: 500,
    maxTimeoutInMs: 30_000,
    randomize: false,
  },
  run: async (payload: { userId: string; data: any[] }) => {
    // Task logic - runs for long time, no timeouts
    console.log(`Processing ${payload.data.length} items for user ${payload.userId}`);
    return { processed: payload.data.length };
  },
});
```

## Schema Task (with validation)

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

export const validatedTask = schemaTask({
  id: "validated-task",
  schema: z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  }),
  run: async (payload) => {
    // Payload is automatically validated and typed
    return { message: `Hello ${payload.name}, age ${payload.age}` };
  },
});
```

## Triggering Tasks

### From Backend Code

```ts
import { tasks } from "@trigger.dev/sdk";
import type { processData } from "./trigger/tasks";

// Single trigger
const handle = await tasks.trigger<typeof processData>("process-data", {
  userId: "123",
  data: [{ id: 1 }, { id: 2 }],
});

// Batch trigger (up to 1,000 items, 3MB per payload)
const batchHandle = await tasks.batchTrigger<typeof processData>("process-data", [
  { payload: { userId: "123", data: [{ id: 1 }] } },
  { payload: { userId: "456", data: [{ id: 2 }] } },
]);
```

### Debounced Triggering

Consolidate multiple triggers into a single execution:

```ts
// Multiple rapid triggers with same key = single execution
await myTask.trigger(
  { userId: "123" },
  {
    debounce: {
      key: "user-123-update",  // Unique key for debounce group
      delay: "5s",              // Wait before executing
    },
  }
);

// Trailing mode: use payload from LAST trigger
await myTask.trigger(
  { data: "latest-value" },
  {
    debounce: {
      key: "trailing-example",
      delay: "10s",
      mode: "trailing",  // Default is "leading" (first payload)
    },
  }
);
```

**Debounce modes:**
- `leading` (default): Uses payload from first trigger, subsequent triggers only reschedule
- `trailing`: Uses payload from most recent trigger

### From Inside Tasks (with Result handling)

```ts
export const parentTask = task({
  id: "parent-task",
  run: async (payload) => {
    // Trigger and continue
    const handle = await childTask.trigger({ data: "value" });

    // Trigger and wait - returns Result object, NOT task output
    const result = await childTask.triggerAndWait({ data: "value" });
    if (result.ok) {
      console.log("Task output:", result.output); // Actual task return value
    } else {
      console.error("Task failed:", result.error);
    }

    // Quick unwrap (throws on error)
    const output = await childTask.triggerAndWait({ data: "value" }).unwrap();

    // Batch trigger and wait
    const results = await childTask.batchTriggerAndWait([
      { payload: { data: "item1" } },
      { payload: { data: "item2" } },
    ]);

    for (const run of results) {
      if (run.ok) {
        console.log("Success:", run.output);
      } else {
        console.log("Failed:", run.error);
      }
    }
  },
});

export const childTask = task({
  id: "child-task",
  run: async (payload: { data: string }) => {
    return { processed: payload.data };
  },
});
```

> Never wrap triggerAndWait or batchTriggerAndWait calls in a Promise.all or Promise.allSettled as this is not supported in Trigger.dev tasks.

## Waits

```ts
import { task, wait } from "@trigger.dev/sdk";

export const taskWithWaits = task({
  id: "task-with-waits",
  run: async (payload) => {
    console.log("Starting task");

    // Wait for specific duration
    await wait.for({ seconds: 30 });
    await wait.for({ minutes: 5 });
    await wait.for({ hours: 1 });
    await wait.for({ days: 1 });

    // Wait until specific date
    await wait.until({ date: new Date("2024-12-25") });

    // Wait for token (from external system)
    await wait.forToken({
      token: "user-approval-token",
      timeoutInSeconds: 3600, // 1 hour timeout
    });

    console.log("All waits completed");
    return { status: "completed" };
  },
});
```

> Never wrap wait calls in a Promise.all or Promise.allSettled as this is not supported in Trigger.dev tasks.

## Key Points

- **Result vs Output**: `triggerAndWait()` returns a `Result` object with `ok`, `output`, `error` properties - NOT the direct task output
- **Type safety**: Use `import type` for task references when triggering from backend
- **Waits > 5 seconds**: Automatically checkpointed, don't count toward compute usage
- **Debounce + idempotency**: Idempotency keys take precedence over debounce settings

## NEVER Use (v2 deprecated)

```ts
// BREAKS APPLICATION
client.defineJob({
  id: "job-id",
  run: async (payload, io) => {
    /* ... */
  },
});
```

Use SDK (`@trigger.dev/sdk`), check `result.ok` before accessing `result.output`

<!-- TRIGGER.DEV basic END -->