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
2. **Persistent Storage:** Modal volumes (`/my-app`) preserve code between sessions
3. **Smart Reuse:** Existing healthy sandboxes are reused instead of creating new ones
4. **Node Image Caching:** Pre-built Node 20 image with Expo CLI and git installed
5. **Port Exposure:** Port 19006 exposed for Expo web preview via tunnel URLs

**Key Constants:** `lib/constants.ts`
- `WORKING_DIR = "/my-app"` - App directory in sandbox
- `EXPO_PORT = 19006` - Expo web server port
- Timeout configurations for tunnel, Expo init, bash commands, etc.

**Lifecycle:**
- Create: `POST /api/projects/[id]/sandbox` (creates or reuses sandbox + volume)
- Health: `GET /api/projects/[id]/sandbox/health` (checks process, port, tunnel)
- Logs: `GET /api/projects/[id]/sandbox/logs` (Expo and system logs)
- Delete: `DELETE /api/projects/[id]/sandbox` (terminates sandbox, keeps volume)

### GitHub Integration

**Location:** `lib/server/github.ts`

- **Automatic Repository Creation:** Each project gets a private GitHub repo in `GITHUB_ORG_NAME`
- **Repository Naming:** `dyno-apps-{projectId}`
- **Rollback Mechanism:** If GitHub repo creation fails during project creation, the project is deleted
- **Non-Blocking Deletion:** When deleting projects, GitHub repo deletion errors are logged but don't fail the operation
- **Cloning in Sandboxes:** Repositories are cloned into sandbox volumes during Expo initialization

### API Route Structure

All routes follow RESTful conventions with nested resources:

**Projects:**
- `GET /api/projects` - List all user projects (RLS-filtered)
- `POST /api/projects` - Create project + GitHub repo (with rollback)
- `PATCH /api/projects` - Update project title
- `DELETE /api/projects/[id]` - Delete project, sandbox, volume, and GitHub repo

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
modal_volume_id     TEXT              -- Modal volume ID for persistence
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

The builder state persists to SessionStorage (not LocalStorage) and is cleared on logout:

```typescript
{
  projectName: string
  projectId: string | null
  messages: StoreMessage[]
  generatedCode: string
  sandboxId: string | null
  previewUrl: string | null
  sandboxHealthStatus: 'unknown' | 'healthy' | 'unhealthy' | 'not_found'
  modifiedFiles: ModifiedFile[]
  lastActivity: Date | null
}
```

**Custom Persistence:** `lib/stores/persist.ts` - SessionStorage adapter with Date serialization

**Key Hooks:**
- `useProjectSession` - Project and sandbox initialization
- `useCodeGeneration` - SSE streaming for AI code generation
- `useProjectLoader` - Project validation and loading

### Authentication Flow

**Middleware:** `middleware.ts`
- Protects `/builder` and `/project-gallery` routes
- Redirects unauthenticated users to `/login?redirect={path}`
- Redirects authenticated users away from `/login` and `/signup`

**Beta Access:** `app/api/auth/signup/route.ts`
- Requires invite code from `BETA_INVITE_CODES` environment variable (comma-separated)
- Returns 403 for invalid codes

**Supabase Integration:**
- Client: `lib/supabase/client.ts` (browser)
- Server: `lib/supabase/server.ts` (server-side with cookie handling)

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

### Modal Sandbox Operations

When interacting with sandboxes:

1. **Always check sandbox health** before operations via `/sandbox/health`
2. **Use idempotent operations** - handle `NotFoundError` gracefully
3. **Batch file reads** in parallel when possible (see `executeToolRequest()`)
4. **Respect timeouts** - bash commands have 2-minute default, 10-minute max
5. **Working directory is `/my-app`** - all Expo project files live here
6. **Volume persistence** - code survives sandbox termination

### Project Initialization Flow

The correct sequence for new projects:

1. User sends first message
2. `initializeProject(message)` creates project in Supabase + GitHub repo
3. `POST /api/projects/[id]/sandbox` creates sandbox + volume
4. `POST /api/init-expo` initializes Expo (clones repo, runs create-expo-app)
5. `POST /api/projects/[id]/chat` streams code generation

Never skip steps or reorder them - each depends on the previous step completing.

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
- `BETA_INVITE_CODES` - Comma-separated invite codes (e.g., "code1,code2")
- `GITHUB_ORG_NAME` + `GITHUB_PAT` - GitHub org and personal access token

**Important:**
- Never use Supabase secret key client-side - only use `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GITHUB_PAT` must have `repo` permissions for the organization
- Keep server-only vars (`MODAL_TOKEN_SECRET`, `GITHUB_PAT`, `ANTHROPIC_API_KEY`) out of client code

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
