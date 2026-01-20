# Trigger.dev Migration Plan: Coding Agent

## Overview

This plan migrates the long-running coding agent from inline execution in Vercel serverless functions to Trigger.dev background tasks. This eliminates the 5-minute Vercel timeout limitation.

### Current Architecture
```
Frontend → POST /api/projects/[id]/chat → runCodingAgent() → SSE stream
                                              ↓
                                         (up to 50 iterations)
                                              ↓
                                         Vercel timeout at 300s
```

### Target Architecture
```
Frontend → POST /api/projects/[id]/chat → Trigger task → { runId, token }
              ↓                                              ↓
         useRealtimeRun(runId) ←──── metadata updates ←─────┘
              ↓
         Real-time UI updates
```

### Key Benefits
- **No timeout limits**: Tasks can run for hours
- **Better observability**: Each run visible in Trigger.dev dashboard
- **Cost efficiency**: Only charged for active compute (not LLM wait time)
- **Built-in retry/recovery**: Trigger.dev handles failures gracefully
- **Real-time updates**: Native streaming via metadata and React hooks

---

## Implementation Progress (as of 2026-01-20)

### ✅ Completed

**Phase 1: Setup & Dependencies**
- Installed `@trigger.dev/sdk` and `@trigger.dev/react-hooks` packages
- Created `trigger.config.ts` in project root
- Created `trigger/` directory with `index.ts` and `coding-agent.ts`
- Environment variables configured: `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_ID`, `SUPABASE_SECRET_KEY`

**Phase 2: Task Implementation**
- Created full `trigger/coding-agent.ts` with complete agent logic
- Ported all logic from `runCodingAgent()` including:
  - BAML agent calls with retry logic
  - Tool execution loop
  - Metadata updates for real-time progress (`status`, `iteration`, `currentTool`, `todos`, etc.)
  - State persistence integration

**Phase 3: State Persistence Migration**
- Created Supabase migration: `supabase/migrations/20260120172425_add_agent_state.sql`
- Created `lib/supabase/service.ts` - service client using `SUPABASE_SECRET_KEY` for background tasks
- Updated `lib/server/agent-state-store.ts` to use Supabase instead of in-memory Map
- Updated both `lib/server/coding-agent.ts` and `trigger/coding-agent.ts` to use async state functions
- Database migration applied via `supabase db push`

**Phase 4: API Route Update**
- Updated `app/api/projects/[id]/chat/route.ts` with dual-path implementation
- Added `USE_TRIGGER_DEV` feature flag (env var) for gradual rollout
- Trigger.dev path returns JSON `{ runId, publicAccessToken, generatedTitle? }` immediately
- SSE path preserved for fallback when `USE_TRIGGER_DEV !== "true"`
- Added proper error handling with appropriate HTTP status codes
- Note: "ask" mode not yet supported with Trigger.dev (returns 400 error)

**Phase 5: Frontend Changes**
- Updated `hooks/useCodeGeneration.ts` to support both SSE and Trigger.dev paths
- Added `useRealtimeRun` hook integration for real-time Trigger.dev updates
- Detects response type via `Content-Type` header (JSON = Trigger.dev, SSE = original)
- Maps Trigger.dev metadata to existing `AgentAction` UI format
- Added `isGenerating` return value to track generation state
- No UI component changes needed - existing components work with both paths

**Phase 6: Cancellation Support**
- Created `app/api/projects/[id]/chat/cancel/route.ts` - POST endpoint to cancel Trigger.dev runs
- Added `cancelGeneration()` function to `useCodeGeneration` hook
- Added `PROJECT_CHAT_CANCEL` endpoint to `lib/constants.ts`
- Returns `triggerRunId` from hook to allow checking if there's an active run
- Updated `ChatPanel.tsx` to use `isGenerating` from hook (combined with local `isLoading`)
- Updated `handleStop` in `ChatPanel.tsx` to call `cancelGeneration()` for Trigger.dev runs
- `cancelGeneration()` immediately updates UI after successful API call (doesn't wait for real-time subscription)

**Phase 7: Testing & Validation (Partial)**
- ✅ Test 1: Trigger.dev happy path - task triggers, real-time updates work, completes successfully
- ✅ Test 2: Cancellation - stop button visible during generation, cancels task, UI shows "Stopped processing"

### 🔄 Next Steps

**Remaining Testing:**
- [ ] Test 3: SSE fallback path (with `USE_TRIGGER_DEV=false`)
- [ ] Test 4: Error handling scenarios
- [ ] Test 5: State persistence in Supabase

**Phase 8: Deployment**
- [ ] Deploy to staging with `USE_TRIGGER_DEV=true`
- [ ] Smoke test in staging
- [ ] Deploy to production with feature flag
- [ ] Gradually enable for all users

### 📁 Files Created/Modified

| File | Status | Notes |
|------|--------|-------|
| `trigger.config.ts` | ✅ Created | Trigger.dev configuration |
| `trigger/index.ts` | ✅ Created | Exports all tasks |
| `trigger/coding-agent.ts` | ✅ Created | Full task implementation (~420 lines) |
| `lib/supabase/service.ts` | ✅ Created | Service client for background tasks |
| `lib/server/agent-state-store.ts` | ✅ Modified | Now uses Supabase (async functions) |
| `lib/server/coding-agent.ts` | ✅ Modified | Updated to use async state functions |
| `supabase/migrations/20260120172425_add_agent_state.sql` | ✅ Created | Database migration (applied) |
| `app/api/projects/[id]/chat/route.ts` | ✅ Modified | Dual-path: Trigger.dev + SSE fallback |
| `hooks/useCodeGeneration.ts` | ✅ Modified | Dual-path: SSE + Trigger.dev realtime + cancellation |
| `app/api/projects/[id]/chat/cancel/route.ts` | ✅ Created | Cancellation endpoint for Trigger.dev runs |
| `lib/constants.ts` | ✅ Modified | Added PROJECT_CHAT_CANCEL endpoint |
| `components/builder/ChatPanel.tsx` | ✅ Modified | Uses isGenerating + cancelGeneration from hook |

### ⚠️ Important Notes for Continuation

1. **State functions are now async**: Both `getAgentState()` and `setAgentState()` return Promises. All callers have been updated.

2. **Dual-path implementation complete**: Both API route and frontend hook support SSE (default) and Trigger.dev paths. Set `USE_TRIGGER_DEV=true` in env to enable Trigger.dev.

3. **Trigger.dev config updates**: `trigger.config.ts` requires `maxDuration` (set to 3600s) and `build.external: ["@boundaryml/baml"]` for BAML native module compatibility.

4. **BAML version**: Upgraded to `@boundaryml/baml@0.215.0` to match generated client.

5. **Testing not yet done**: The Trigger.dev dev server runs (`pnpm dlx trigger.dev@latest dev`), but end-to-end testing of the POST endpoint and real-time updates is pending.

6. **Service client uses secret key**: `lib/supabase/service.ts` uses `SUPABASE_SECRET_KEY` (new `sb_secret_...` format) for bypassing RLS in background tasks.

---

## Phase 1: Setup & Dependencies

### 1.1 Install Trigger.dev Packages

```bash
pnpm add @trigger.dev/sdk @trigger.dev/react-hooks
```

### 1.2 Environment Variables

Add to `.env.local` and Vercel:

```env
TRIGGER_SECRET_KEY=tr_dev_xxx        # From Trigger.dev dashboard
TRIGGER_PROJECT_ID=proj_xxx          # Project identifier
NEXT_PUBLIC_TRIGGER_PUBLIC_KEY=pk_xxx # For frontend React hooks (optional)
SUPABASE_SECRET_KEY=sb_secret_xxx    # For Trigger.dev tasks (from Supabase dashboard → Settings → API)
```

### 1.3 Trigger.dev Configuration

Create `trigger.config.ts` in project root:

```typescript
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID!,
  dirs: ["./trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 1, // We handle retries internally via BAML
    },
  },
});
```

### 1.4 Project Structure

```
dyno-apps/
├── trigger/
│   ├── coding-agent.ts      # Main coding agent task
│   └── index.ts             # Export all tasks
├── trigger.config.ts        # Trigger.dev configuration
└── ...existing files
```

---

## Phase 2: Trigger.dev Task Definition

### 2.1 Create Coding Agent Task

**File: `trigger/coding-agent.ts`**

This task will contain the same logic as `runCodingAgent()` but adapted for Trigger.dev:

#### Payload Interface
```typescript
interface CodingAgentPayload {
  projectId: string;
  sandboxId: string;
  userPrompt: string;
  userId: string;
  workingDir?: string;
  maxIterations?: number;
}
```

#### Result Interface
```typescript
interface CodingAgentTaskResult {
  success: boolean;
  message?: string;
  files?: Record<string, string>;
  error?: string;
  iterations?: number;
}
```

#### Metadata for Real-time Updates
```typescript
// Updated during task execution for frontend visibility
interface AgentMetadata {
  status: 'starting' | 'thinking' | 'executing_tool' | 'complete' | 'error' | 'stopped';
  iteration: number;
  maxIterations: number;
  currentTool?: string;
  toolDescription?: string;
  todos?: TodoItem[];
  modifiedFiles?: string[];
}
```

### 2.2 Task Implementation Outline

```typescript
import { task, metadata } from "@trigger.dev/sdk/v3";

export const codingAgentTask = task({
  id: "coding-agent",

  run: async (payload: CodingAgentPayload, { ctx }) => {
    const { projectId, sandboxId, userPrompt, userId, maxIterations = 50 } = payload;

    // 1. Initialize
    await metadata.set("status", "starting");
    await metadata.set("iteration", 0);
    await metadata.set("maxIterations", maxIterations);

    // 2. Load state from persistent store
    let state = await loadAgentState(projectId);
    state.push({ role: "user", message: userPrompt });

    // 3. Initialize Modal client
    const modal = createModalClient();

    // 4. Iteration loop (same as current runCodingAgent)
    for (let i = 0; i < maxIterations; i++) {
      await metadata.set("iteration", i + 1);
      await metadata.set("status", "thinking");

      // Call BAML agent
      const response = await callCodingAgentWithRetry(state, sandboxId, userId);

      // Check for completion
      if (response.type === "reply_to_user") {
        await metadata.set("status", "complete");
        await saveAgentState(projectId, state);
        return {
          success: true,
          message: response.reply,
          files: modifiedFiles,
          iterations: i + 1,
        };
      }

      // Execute tool
      await metadata.set("status", "executing_tool");
      await metadata.set("currentTool", response.tool.type);
      await metadata.set("toolDescription", getToolDescription(response.tool));

      const result = await executeToolRequest(modal, sandboxId, response.tool);

      // Update state
      state.push({ role: "assistant", toolCall: response.tool });
      state.push({ role: "tool", result });

      // Update metadata with modified files and todos
      if (response.tool.type === "write_file") {
        // Track modified files
      }
      if (response.tool.type === "todo_write") {
        await metadata.set("todos", response.tool.todos);
      }
    }

    // Max iterations reached
    return {
      success: true,
      message: "Reached maximum iterations",
      iterations: maxIterations,
    };
  },
});
```

### 2.3 Key Differences from Current Implementation

| Aspect | Current (`runCodingAgent`) | Trigger.dev Task |
|--------|---------------------------|------------------|
| Progress updates | `onProgress` callback → SSE | `metadata.set()` → Realtime API |
| State persistence | In-memory Map | Database (Supabase) |
| Abort handling | `AbortSignal` | Trigger.dev cancellation |
| Timeout | 300s Vercel limit | No limit |
| Error recovery | Manual try/catch | Trigger.dev retry system |

---

## Phase 3: State Persistence Migration

### 3.1 Problem

Current `agent-state-store.ts` uses in-memory `Map<projectId, Message[]>`. This won't work with Trigger.dev because:

**Process Isolation:**
```
Current Architecture (same process):
┌─────────────────────────────────────────┐
│ Next.js Process                         │
│  ├── API Route                          │
│  ├── runCodingAgent() ◄─── same process │
│  └── Map<projectId, Message[]> ◄────────┘
│       (accessible from agent)           │
└─────────────────────────────────────────┘

Trigger.dev Architecture (separate processes):
┌─────────────────────────┐     ┌─────────────────────────┐
│ Next.js Process         │     │ Trigger.dev Worker      │
│  ├── API Route          │     │  ├── codingAgentTask    │
│  └── Map<...> ──────────┼──X──┼──► CANNOT ACCESS        │
│       (lives here)      │     │     (different process) │
└─────────────────────────┘     └─────────────────────────┘
```

The Trigger.dev worker runs in a **completely separate process** (often on different infrastructure). It cannot access the in-memory `Map` in your Next.js server.

**Additional reasons for external persistence:**
1. **Between user messages**: User sends message, waits for completion, sends another message hours later - state must persist
2. **Server restarts**: Current in-memory store loses everything on Vercel deploy anyway
3. **Multi-instance**: If Next.js scales to multiple instances, in-memory state isn't shared

### 3.2 Solution: Supabase Persistence

Add a new table for agent state:

```sql
-- Migration: Add agent_state table
CREATE TABLE public.agent_state (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX agent_state_updated_at_idx ON public.agent_state(updated_at);

-- RLS policy
ALTER TABLE public.agent_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own project state"
  ON public.agent_state FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );
```

### 3.3 New State Store Functions

**File: `lib/server/agent-state-store.ts`** (modified)

```typescript
import { createServerClient } from "@/lib/supabase/server";

export async function getAgentState(projectId: string): Promise<Message[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("agent_state")
    .select("state")
    .eq("project_id", projectId)
    .single();

  return data?.state ?? [];
}

export async function setAgentState(projectId: string, state: Message[]): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("agent_state")
    .upsert({
      project_id: projectId,
      state,
      updated_at: new Date().toISOString(),
    });
}

export async function clearAgentState(projectId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("agent_state")
    .delete()
    .eq("project_id", projectId);
}
```

---

## Phase 4: API Route Changes

### 4.1 Current Route: `app/api/projects/[id]/chat/route.ts`

The current route:
1. Authenticates user
2. Validates project
3. Calls `runCodingAgent()` inline
4. Streams SSE events via `TransformStream`

### 4.2 New Route Behavior

The new route will:
1. Authenticate user
2. Validate project
3. Trigger the Trigger.dev task
4. Return `{ runId, publicAccessToken }` immediately

```typescript
import { tasks } from "@trigger.dev/sdk/v3";
import { codingAgentTask } from "@/trigger/coding-agent";

export async function POST(request: NextRequest, { params }) {
  // Authentication & validation (unchanged)
  const user = await getAuthenticatedUser(request);
  const project = await getProject(params.id, user.id);

  if (!project?.currentSandboxId) {
    return Response.json({ error: "No active sandbox" }, { status: 400 });
  }

  const { userPrompt, mode } = await request.json();

  // Auto-generate title (unchanged)
  const generatedTitle = await autoGenerateProjectTitle(params.id, user.id, userPrompt);

  // Trigger the task instead of running inline
  const handle = await tasks.trigger<typeof codingAgentTask>("coding-agent", {
    projectId: params.id,
    sandboxId: project.currentSandboxId,
    userPrompt: userPrompt.trim(),
    userId: user.id,
  });

  // Return immediately with run info
  return Response.json({
    runId: handle.id,
    publicAccessToken: handle.publicAccessToken,
    generatedTitle, // Include if title was generated
  });
}
```

### 4.3 Response Format Change

| Current | New |
|---------|-----|
| SSE stream with events | JSON: `{ runId, publicAccessToken, generatedTitle? }` |
| Long-lived connection | Immediate response (<1s) |
| Keepalive every 15s | Not needed |

---

## Phase 5: Frontend Changes

### 5.1 Current Hook: `hooks/useCodeGeneration.ts`

Currently:
- Fetches SSE stream from `/api/projects/[id]/chat`
- Parses SSE events manually
- Updates UI state with `AgentAction` objects

### 5.2 New Hook Implementation

Replace SSE parsing with Trigger.dev's React hooks:

```typescript
"use client";

import { useState, useCallback } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { codingAgentTask } from "@/trigger/coding-agent";

interface UseCodeGenerationResult {
  startGeneration: (prompt: string, projectId: string) => Promise<void>;
  isGenerating: boolean;
  currentIteration: number | null;
  maxIterations: number | null;
  currentTool: string | null;
  toolDescription: string | null;
  status: string | null;
  todos: TodoItem[] | null;
  error: Error | null;
  result: CodingAgentTaskResult | null;
}

export function useCodeGeneration(): UseCodeGenerationResult {
  const [runId, setRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Subscribe to real-time updates
  const { run, error } = useRealtimeRun<typeof codingAgentTask>(runId, {
    accessToken: accessToken ?? undefined,
    enabled: !!runId && !!accessToken,

    onComplete: (completedRun) => {
      // Reset state for next generation
      setRunId(null);
      setAccessToken(null);
    },
  });

  const startGeneration = useCallback(async (prompt: string, projectId: string) => {
    const response = await fetch(`/api/projects/${projectId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrompt: prompt, mode: "build" }),
    });

    const { runId, publicAccessToken } = await response.json();
    setRunId(runId);
    setAccessToken(publicAccessToken);
  }, []);

  // Extract metadata from run
  const metadata = run?.metadata as AgentMetadata | undefined;

  return {
    startGeneration,
    isGenerating: !!run && !run.isCompleted,
    currentIteration: metadata?.iteration ?? null,
    maxIterations: metadata?.maxIterations ?? null,
    currentTool: metadata?.currentTool ?? null,
    toolDescription: metadata?.toolDescription ?? null,
    status: metadata?.status ?? null,
    todos: metadata?.todos ?? null,
    error,
    result: run?.isSuccess ? run.output : null,
  };
}
```

### 5.3 UI Component Updates

Components consuming `useCodeGeneration` need updates:

#### Builder Chat Panel
- Remove SSE-specific message parsing
- Use hook's derived state directly
- Map Trigger.dev status to existing `AgentAction` UI

#### Thinking Message Component
- Adapt to receive progress from hook instead of SSE events
- Map `currentTool` to `AgentActionType`
- Use `iteration` / `maxIterations` for progress indicator

### 5.4 Message State Integration

Current flow appends messages to Zustand store. New flow:

```typescript
// In chat panel component
const {
  startGeneration,
  isGenerating,
  status,
  currentTool,
  result
} = useCodeGeneration();

// When user submits
const handleSubmit = async (prompt: string) => {
  // Add user message immediately
  addMessage({ role: "user", content: prompt });

  // Add thinking message
  const thinkingId = addThinkingMessage();

  // Start generation
  await startGeneration(prompt, projectId);
};

// When complete (via useEffect watching result)
useEffect(() => {
  if (result?.success) {
    finalizeThinkingMessage(thinkingId);
    addMessage({ role: "assistant", content: result.message });
  }
}, [result]);
```

---

## Phase 6: Cancellation Support

### 6.1 Current Implementation

- Frontend uses `AbortController`
- Signal passed to `runCodingAgent()`
- Agent checks `signal.aborted` before iterations

### 6.2 Trigger.dev Cancellation

Add a cancel endpoint:

**File: `app/api/projects/[id]/chat/cancel/route.ts`**

```typescript
import { runs } from "@trigger.dev/sdk/v3";

export async function POST(request: NextRequest, { params }) {
  const { runId } = await request.json();

  await runs.cancel(runId);

  return Response.json({ success: true });
}
```

Frontend hook addition:

```typescript
const cancelGeneration = useCallback(async () => {
  if (runId) {
    await fetch(`/api/projects/${projectId}/chat/cancel`, {
      method: "POST",
      body: JSON.stringify({ runId }),
    });
  }
}, [runId, projectId]);
```

---

## Phase 7: Testing Strategy

### 7.1 Local Development

```bash
# Terminal 1: Run Next.js dev server
pnpm dev

# Terminal 2: Run Trigger.dev dev server
pnpm dlx trigger.dev@latest dev
```

### 7.2 Test Cases

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| Basic generation | Simple "create hello world" | Completes within 10 iterations |
| Long generation | Complex multi-file app | Completes within 50 iterations |
| Cancellation | Cancel mid-generation | Task stops, state preserved |
| Error recovery | Sandbox error during tool | Error reported, can retry |
| Timeout (none) | Let task run >5 minutes | Completes successfully |
| State persistence | Refresh page mid-generation | Can see progress on reload |

### 7.3 Integration Tests

- Test Trigger.dev task directly via `tasks.trigger()`
- Test API route returns `runId` and `publicAccessToken`
- Test frontend hook receives metadata updates
- Test cancellation flow end-to-end

---

## Phase 8: Rollback Plan

### 8.1 Feature Flag

Use environment variable to switch between implementations:

```typescript
// In API route
if (process.env.USE_TRIGGER_DEV === "true") {
  // Trigger.dev path
  const handle = await tasks.trigger(...);
  return Response.json({ runId: handle.id, ... });
} else {
  // Current SSE path
  return streamingResponse(...);
}
```

### 8.2 Rollback Steps

1. Set `USE_TRIGGER_DEV=false` in Vercel
2. Redeploy
3. Frontend falls back to SSE mode (need to maintain both code paths initially)

### 8.3 Parallel Running Period

Keep both implementations for 2 weeks:
- New users get Trigger.dev
- Existing sessions can complete on SSE
- Monitor for issues before removing old code

---

## Phase 9: Migration Steps

### Step 1: Infrastructure Setup
- [x] Create Trigger.dev account and project
- [x] Add environment variables to `.env.local` and Vercel
- [x] Install dependencies
- [x] Create `trigger.config.ts`

### Step 2: Database Migration
- [x] Create `agent_state` table migration
- [x] Run `supabase db push`
- [x] Update `agent-state-store.ts` with Supabase functions
- [ ] Test state persistence

### Step 3: Task Implementation
- [x] Create `trigger/coding-agent.ts`
- [x] Port logic from `runCodingAgent()`
- [x] Add metadata updates for real-time progress
- [ ] Test task locally with `trigger.dev dev`

### Step 4: API Route Update
- [x] Update `app/api/projects/[id]/chat/route.ts`
- [x] Add feature flag for gradual rollout
- [ ] Test endpoint returns `runId` correctly (Trigger.dev dev server runs, POST testing deferred)

### Step 5: Frontend Migration
- [x] Update `useCodeGeneration` hook
- [x] Update UI components to use new hook interface (no changes needed - existing UI works)
- [x] Add cancellation support (Phase 6)
- [ ] Test real-time updates in browser

### Step 6: Testing & Validation
- [ ] Run full test suite
- [ ] Manual testing of all flows
- [ ] Load testing with concurrent users
- [ ] Verify Vercel timeout is no longer an issue

### Step 7: Deployment
- [ ] Deploy to staging with `USE_TRIGGER_DEV=true`
- [ ] Smoke test in staging
- [ ] Deploy to production with feature flag
- [ ] Gradually enable for all users

### Step 8: Cleanup
- [ ] Remove feature flag after stable period
- [ ] Remove old SSE streaming code
- [ ] Remove in-memory state store
- [ ] Update documentation

---

## Appendix A: File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `package.json` | Modify | Add Trigger.dev dependencies |
| `trigger.config.ts` | Create | Trigger.dev configuration |
| `trigger/coding-agent.ts` | Create | Main agent task |
| `trigger/index.ts` | Create | Task exports |
| `lib/server/agent-state-store.ts` | Modify | Supabase persistence |
| `lib/supabase/service.ts` | Create | Service role client for background tasks |
| `app/api/projects/[id]/chat/route.ts` | Modify | Trigger task instead of inline |
| `app/api/projects/[id]/chat/cancel/route.ts` | Create | Cancellation endpoint |
| `hooks/useCodeGeneration.ts` | Modify | Use Trigger.dev React hooks + cancellation |
| `lib/constants.ts` | Modify | Add PROJECT_CHAT_CANCEL endpoint |
| `supabase/migrations/20260120172425_add_agent_state.sql` | Create | Database migration |

---

## Appendix B: Cost Estimate

Based on [Trigger.dev pricing](https://trigger.dev/pricing):

| Scenario | Active Compute | Estimated Cost |
|----------|----------------|----------------|
| Quick build (30s) | 30s | ~$0.001 |
| Medium build (2min) | 120s | ~$0.004 |
| Long build (10min) | 600s | ~$0.02 |
| 1000 builds/month (avg 2min) | 33 hours | ~$4.00 |

**Note**: LLM wait time is not charged due to checkpointing.

Pro plan ($50/mo) includes $50 usage credit, sufficient for ~12,500 medium builds.

---

## Appendix C: Open Questions

1. **State size limits**: How large can `agent_state.state` JSONB column be? May need to implement state pruning for very long conversations.

2. **Concurrent builds**: Should we limit to one active build per project? Current implementation doesn't prevent this.

3. **Observability**: Do we need to integrate Trigger.dev traces with existing Boundary Studio setup?

4. **Webhook notifications**: Should we add a webhook endpoint for Trigger.dev to call on completion as a backup to Realtime?
