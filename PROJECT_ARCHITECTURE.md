# Project Architecture

This document provides a detailed technical overview of the Dyno Apps system architecture. For setup instructions and getting started, see the [README](./README.md).

## System Overview

Dyno Apps is an AI-powered mobile app builder that allows users to create Expo/React Native applications through natural language conversation. The system consists of several interconnected components:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (Next.js)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Chat Panel  │  │Preview Panel│  │ Code Viewer │  │  Zustand Store      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Layer (Next.js Routes)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ /api/chat   │  │/api/sandbox │  │/api/projects│  │  /api/auth          │ │
│  │ (SSE/JSON)  │  │             │  │             │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
        │                   │                                    │
        ▼                   ▼                                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐
│  Trigger.dev  │  │ Modal Sandbox │  │   Supabase    │  │     GitHub        │
│  (Background  │  │  (Isolated    │  │  (Database +  │  │  (Repository      │
│   Tasks)      │  │   Runtime)    │  │    Auth)      │  │   Storage)        │
└───────────────┘  └───────────────┘  └───────────────┘  └───────────────────┘
        │
        ▼
┌───────────────┐
│  ClickHouse   │
│  (Analytics)  │
└───────────────┘
```

## Core Components

### 1. AI Agent System (BAML)

The AI system is built using [BAML (Boundary ML)](https://www.boundaryml.com/), a domain-specific language for defining AI agents and their tool schemas.

**Location:** `baml_src/`

#### Agent Architecture

```
baml_src/
├── coding-agent.baml      # Main coding agent definition
├── tools.baml             # Tool schemas (file ops, todos)
├── shared-prompts.baml    # Reusable prompt components
├── clients.baml           # LLM client configurations
├── generators.baml        # Code generators config
├── title-generator.baml   # Project title generation
└── commit-message-generator.baml  # Git commit messages
```

#### Coding Agent

The `CodingAgent` function is the primary agent that handles code generation:

- **Input:** Conversation state, working directory, todo list
- **Output:** Tool calls or user reply
- **Client:** Configurable via `baml_src/clients.baml` (supports fallback chains)

#### Tool System

| Tool | Purpose |
|------|---------|
| `ListFilesTool` | Directory exploration |
| `ReadFileTool` | Single file reading |
| `ReadFilesTool` | Batch parallel file reads |
| `WriteFileTool` | File creation/modification |
| `EditTool` | Targeted file edits |
| `VerifyExpoServerTool` | Check Expo compilation |
| `TodoWriteTool` | Progress tracking |

#### Agent Loop

1. User sends message
2. Agent analyzes and calls tools or replies
3. Tool results are fed back to agent
4. Loop continues until agent replies to user

**Orchestration:** `lib/server/coding-agent.ts`

### 2. Execution Modes

The system supports two execution modes for handling AI agent tasks:

#### SSE Streaming (Default)

Traditional Server-Sent Events streaming:

```
Client → POST /api/projects/[id]/chat
       ← SSE stream with progress events
       ← Final result
```

- Real-time progress updates
- Subject to Vercel's 5-minute timeout
- Good for short tasks

#### Trigger.dev Background Tasks

Long-running tasks executed on Trigger.dev infrastructure:

```
Client → POST /api/projects/[id]/chat
       ← JSON { runId, publicAccessToken }

Client → useRealtimeRun(runId) subscription
       ← Real-time metadata updates
       ← Final result
```

- No timeout limitations (up to 1 hour)
- Uses Trigger.dev's `metadata` API for real-time updates
- Enabled via `USE_TRIGGER_DEV=true`

**Configuration:** `trigger.config.ts`
**Task Definition:** `trigger/coding-agent.ts`

### 3. Modal Sandbox Architecture

Each project runs in an isolated [Modal](https://modal.com/) sandbox with in-memory storage.

**Location:** `lib/server/modal.ts`

#### Sandbox Lifecycle

```
Project Created → No sandbox yet
       │
       ▼
User Opens Project → GET /sandbox/health
       │
       ├─ Healthy sandbox exists → Reuse
       │
       └─ No sandbox → POST /sandbox (create)
              │
              ▼
       Initialize Expo app
              │
              ▼
       Start Expo web server (port 19006)
              │
              ▼
       Create tunnel URL for preview
```

#### Key Constants (`lib/constants.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `SANDBOX_WORKING_DIR` | `/root/my-app` | App directory in sandbox |
| `EXPO_PORT` | `19006` | Expo web server port |
| `BASH_TIMEOUT` | 2 minutes | Default command timeout |
| `BASH_TIMEOUT_MAX` | 10 minutes | Maximum command timeout |

#### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects/[id]/sandbox` | POST | Create/reuse sandbox |
| `/api/projects/[id]/sandbox` | DELETE | Terminate sandbox |
| `/api/projects/[id]/sandbox/health` | GET | Health check |
| `/api/projects/[id]/sandbox/logs` | GET | Fetch logs |

### 4. Database Schema (Supabase)

**Primary Database:** Supabase (PostgreSQL)

#### Tables

**`projects`**
```sql
id                  UUID PRIMARY KEY
title               TEXT NOT NULL
description         TEXT
repository_url      TEXT              -- GitHub repo URL
current_sandbox_id  TEXT              -- Active Modal sandbox
user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ       -- Auto-updated via trigger
```

**`agent_state`**
```sql
project_id          UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE
state               JSONB             -- Full Message[] conversation state
updated_at          TIMESTAMPTZ
```

#### Row-Level Security (RLS)

All tables enforce user-scoped access:
- Users can only read/write their own projects
- Agent state is accessible via service key (for Trigger.dev)

**Migrations:** `supabase/migrations/`

### 5. Analytics (ClickHouse)

Token usage tracking for cost monitoring and analytics.

**Location:** `lib/server/clickhouse.ts`

#### Schema

**`token_usage`**
```sql
user_id             String
project_id          String
iteration           UInt32
input_tokens        UInt32
output_tokens       UInt32
cached_input_tokens UInt32
model               String
timestamp           DateTime DEFAULT now()
```

#### Data Flow

1. Each agent iteration records metrics
2. Records accumulated in-memory during request
3. Batch-inserted at end of request
4. Non-blocking: failures logged but don't affect main flow

### 6. GitHub Integration

Each project gets a private GitHub repository for version control.

**Location:** `lib/server/github.ts`

#### Repository Lifecycle

```
Project Creation → Create GitHub repo (dyno-apps-{projectId})
       │                    │
       │                    └─ Failure? → Rollback project creation
       ▼
Sandbox Init → Clone repo into sandbox
       │
       ▼
Code Generation → Commit changes
       │
       ▼
Project Deletion → Delete GitHub repo (non-blocking)
```

### 7. Frontend State Management

**Store:** `lib/store.ts` (Zustand)

#### State Structure

```typescript
// PERSISTED (localStorage)
{
  currentMode: 'ask' | 'build'  // User preference
}

// RUNTIME (not persisted)
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

#### Key Principle

**URL as Source of Truth:** The project ID comes from the route `/builder/[projectId]`, not from persisted state. This prevents "sticky project" bugs when navigating between projects.

### 8. Authentication Flow

**Location:** `middleware.ts`

```
User Request
     │
     ▼
┌────────────────┐
│  Middleware    │
│  checks auth   │
└────────────────┘
     │
     ├─ Protected route + No session → Redirect to /login?redirect={path}
     │
     ├─ Auth route + Has session → Redirect to /builder
     │
     └─ Otherwise → Continue
```

#### Beta Access

Sign-up requires invite code from `BETA_INVITE_CODES` environment variable.

### 9. API Route Structure

RESTful conventions with nested resources:

```
/api
├── auth/
│   ├── login       POST    - Email/password login
│   ├── logout      POST    - Sign out
│   ├── signup      POST    - Beta sign-up with invite code
│   └── user        GET     - Get current user
│
├── projects/
│   ├── GET         - List user's projects (RLS-filtered)
│   ├── POST        - Create project + GitHub repo
│   ├── PATCH       - Update project title
│   └── [id]/
│       ├── DELETE  - Delete project, sandbox, and repo
│       ├── chat/
│       │   ├── POST        - Start code generation (SSE or JSON)
│       │   └── cancel/
│       │       └── POST    - Cancel Trigger.dev run
│       └── sandbox/
│           ├── POST        - Create/reuse sandbox
│           ├── DELETE      - Terminate sandbox
│           ├── health/
│           │   └── GET     - Health check
│           └── logs/
│               └── GET     - Fetch logs
│
├── init-expo       POST    - Initialize Expo app in sandbox
│
└── feedback        POST    - Submit user feedback (email via Resend)
```

## Data Flow Diagrams

### Code Generation Flow (SSE Mode)

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │  Next.js │     │  Modal   │     │  BAML    │
│  Client  │     │  API     │     │  Sandbox │     │  Agent   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ POST /chat     │                │                │
     │──────────────> │                │                │
     │                │                │                │
     │                │ Load state     │                │
     │                │──────────────> │                │
     │                │                │                │
     │                │                │                │
     │                │ CodingAgent()  │                │
     │                │──────────────────────────────> │
     │                │                │                │
     │ SSE: iteration │ <────────────────────────────── │
     │ <────────────  │                │   tool call   │
     │                │                │                │
     │                │ Execute tool   │                │
     │                │──────────────> │                │
     │                │ <────────────  │                │
     │                │   result       │                │
     │                │                │                │
     │                │ Continue loop...               │
     │                │                │                │
     │ SSE: complete  │                │                │
     │ <────────────  │                │                │
     │                │                │                │
     │                │ Save state     │                │
     │                │──────────────> │                │
     │                │                │                │
```

### Code Generation Flow (Trigger.dev Mode)

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │  Next.js │     │ Trigger  │     │  Modal   │
│  Client  │     │  API     │     │  .dev    │     │  Sandbox │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ POST /chat     │                │                │
     │──────────────> │                │                │
     │                │                │                │
     │                │ tasks.trigger  │                │
     │                │──────────────> │                │
     │                │                │                │
     │ JSON: runId    │                │                │
     │ <────────────  │                │                │
     │                │                │                │
     │ useRealtimeRun │                │                │
     │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─> │                │
     │                │                │                │
     │                │                │ Execute agent  │
     │                │                │──────────────> │
     │                │                │ <────────────  │
     │                │                │                │
     │ metadata update│                │                │
     │ <─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                │
     │                │                │                │
     │ run.status:    │                │                │
     │ COMPLETED      │                │                │
     │ <─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                │
     │                │                │                │
```

## Key Files Reference

| Component | Location |
|-----------|----------|
| Agent orchestration | `lib/server/coding-agent.ts` |
| Tool execution | `lib/server/tool-executors.ts` |
| Trigger.dev task | `trigger/coding-agent.ts` |
| Modal sandbox client | `lib/server/modal.ts` |
| GitHub integration | `lib/server/github.ts` |
| ClickHouse client | `lib/server/clickhouse.ts` |
| Agent state store | `lib/server/agent-state-store.ts` |
| Frontend store | `lib/store.ts` |
| Code generation hook | `hooks/useCodeGeneration.ts` |
| Chat API route | `app/api/projects/[id]/chat/route.ts` |
| Auth middleware | `middleware.ts` |

## Environment Variables

See [.env.local.example](./.env.local.example) for the complete list with descriptions.

### Required

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API |
| `OPENROUTER_API_KEY` | OpenRouter API (alternative models) |
| `MODAL_TOKEN_ID` | Modal sandbox auth |
| `MODAL_TOKEN_SECRET` | Modal sandbox auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key |
| `BETA_INVITE_CODES` | Comma-separated invite codes |
| `GITHUB_ORG_NAME` | GitHub org for repos |
| `GITHUB_PAT` | GitHub personal access token |

### Optional

| Variable | Purpose |
|----------|---------|
| `TRIGGER_SECRET_KEY` | Trigger.dev API key |
| `TRIGGER_PROJECT_ID` | Trigger.dev project |
| `NEXT_PUBLIC_TRIGGER_PUBLIC_KEY` | Trigger.dev public key (frontend) |
| `USE_TRIGGER_DEV` | Enable Trigger.dev mode |
| `SUPABASE_SECRET_KEY` | Service key for background tasks |
| `CLICKHOUSE_HOST` | ClickHouse Cloud URL |
| `CLICKHOUSE_USER` | ClickHouse username |
| `CLICKHOUSE_PASSWORD` | ClickHouse password |
| `BOUNDARY_API_KEY` | BAML LLM call tracing |
| `RESEND_API_KEY` | Email sending |
| `FEEDBACK_EMAIL` | Feedback recipient |
| `EMAIL_FROM` | Email sender address |
