<!-- 8d784ac6-c7bc-4221-b0a2-ed58ff46599b 07ac68ae-9946-4c16-af30-71c332986c64 -->
# Dyno Apps Codebase Refactoring Plan

## Current Issues

### 1. God Components with Mixed Concerns

**ChatPanel.tsx (746 lines)** - The worst offender:

- SSE stream parsing logic mixed with UI rendering
- Project creation, sandbox initialization, and code generation all in one component
- The `sendMessage` callback is ~200 lines handling 5+ different responsibilities
- Message state duplicated from Zustand store
```343:564:components/builder/ChatPanel.tsx
export default function ChatPanel({ initialPrompt }: ChatPanelProps) {
  // ... 200+ lines of mixed concerns
```


**BuilderPage (362 lines)** - Similarly bloated:

- Deep nesting in sandbox validation logic (lines 134-208)
- Name editing logic inline instead of extracted

### 2. Scattered Type Definitions

Types are duplicated across files:

- `Message` interface in both `lib/store.ts` (lines 4-9) and `ChatPanel.tsx` (lines 20-27)
- `Project` interface in both `lib/server/projectStore.ts` and `app/project-gallery/page.tsx`
- No centralized types directory

### 3. Inconsistent API Patterns

Every API route manually checks auth and builds responses:

```12:22:app/api/projects/route.ts
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  // ... actual logic
```

This pattern repeats in every route (~8 files), adding boilerplate.

### 4. Hardcoded Magic Values

- `/my-app` working directory appears in 4+ files
- Port `19006` hardcoded in sandbox routes
- Polling delays scattered (`baseDelay = 2000`, timeout `30000ms`, etc.)

### 5. Monolithic API Route

`generate-code-stream/route.ts` (409 lines) handles too much:

- Modal client setup
- BAML agent orchestration
- SSE streaming
- Error handling with retry logic

### 6. Dead/Placeholder Code

`CodeViewer.tsx` shows static sample code, never the actual generated code:

```6:37:components/builder/CodeViewer.tsx
const sampleCode = `import React from 'react';
// ... hardcoded sample
```

### 7. State Management Issues

`lib/store.ts` has two stores in one file without persistence or proper session handling:

- Builder store doesn't persist messages across refreshes
- Auth store fetch pattern is awkward with `checkAuth()` method

---

## Phased Refactoring Approach

### Phase 1: Foundation - Types and Constants

**Goal**: Establish clean type boundaries and eliminate magic values.

**Changes**:

1. Create `/types/index.ts` with shared interfaces:

   - `Message`, `Project`, `SandboxStatus`, `SSEEvent`, `AgentAction`

2. Create `/lib/constants.ts`:

   - `WORKING_DIR = "/my-app"`
   - `EXPO_PORT = 19006`
   - Timeout/retry configurations

3. Move BAML-generated types to a re-export pattern

**Files to create**:

- `types/index.ts`
- `types/api.ts` (API request/response types)
- `lib/constants.ts`

### Phase 2: API Layer Improvements

**Goal**: Reduce boilerplate and improve consistency.

**Changes**:

1. Create API middleware wrapper:

   - `lib/server/api-utils.ts` with `withAuth()` higher-order function
   - Standardized error responses via `ApiResponse<T>` type

2. Split `generate-code-stream/route.ts`:

   - Extract agent orchestration to `lib/server/coding-agent.ts`
   - Keep route thin (setup + stream)

3. Consolidate Modal client usage in `lib/server/modal.ts` (already exists, extend it)

**Example new pattern**:

```typescript
// lib/server/api-utils.ts
export function withAuth<T>(
  handler: (req: NextRequest, user: User) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return unauthorized();
    return handler(req, user);
  };
}
```

### Phase 3: Component Decomposition

**Goal**: Break up god components into focused, reusable pieces.

**ChatPanel refactoring**:

1. Extract `hooks/useCodeGeneration.ts` - SSE streaming logic
2. Extract `hooks/useProjectSession.ts` - project/sandbox initialization
3. Extract `components/builder/MessageList.tsx` - message rendering
4. Extract `components/builder/ChatInput.tsx` - input handling
5. Keep `ChatPanel.tsx` as a thin orchestrator (~100 lines)

**BuilderPage refactoring**:

1. Extract `hooks/useProjectLoader.ts` - project loading from URL params
2. Extract `components/builder/ProjectHeader.tsx` - header with name editing
3. Simplify sandbox validation into the hook

### Phase 4: State Management Refactoring

**Goal**: Proper session state with persistence readiness.

**Changes**:

1. Split stores into separate files:

   - `lib/stores/auth-store.ts`
   - `lib/stores/builder-store.ts`

2. Add session persistence layer:

   - `lib/stores/persist.ts` using localStorage or session

3. Add proper project session state:

   - Current files modified
   - Message history
   - Sandbox health status

### Phase 5: Future-Ready Architecture

**Goal**: Prepare for git, templates, and enhanced features.

**Changes**:

1. Create abstract storage interface:

   - `lib/storage/types.ts` - `ICodeStorage` interface
   - `lib/storage/supabase.ts` - current Supabase implementation
   - Future: `lib/storage/git.ts` for GitHub integration

2. Create template system:

   - `lib/templates/index.ts` - template registry
   - Templates for common app types (blank, todo, e-commerce starter)

3. Prepare Expo Go integration hooks:

   - `lib/expo/qr-code.ts` - QR code generation
   - Update PreviewPanel for device testing

---

## Priority Order

| Phase | Effort | Impact | Recommended Order |

|-------|--------|--------|-------------------|

| Phase 1 | Low | High | 1st - Enables all other phases |

| Phase 2 | Medium | High | 2nd - Reduces boilerplate significantly |

| Phase 3 | High | High | 3rd - Biggest code quality improvement |

| Phase 4 | Medium | Medium | 4th - Improves user experience |

| Phase 5 | Medium | Medium | 5th - Enables new features |

---

## Key Files to Modify

### High Priority

- `components/builder/ChatPanel.tsx` - decompose
- `app/api/generate-code-stream/route.ts` - extract agent logic
- `lib/store.ts` - split and enhance

### Medium Priority

- `app/builder/page.tsx` - extract hooks
- `app/api/projects/route.ts` - use middleware
- `app/api/projects/[id]/sandbox/route.ts` - use middleware

### Low Priority (Phase 5)

- `lib/server/storage.ts` - abstract interface
- `components/builder/PreviewPanel.tsx` - Expo Go support
- `components/builder/CodeViewer.tsx` - show actual code

---

## Expected Outcomes

After refactoring:

1. **ChatPanel**: 746 lines to ~100 lines (orchestrator only)
2. **API routes**: ~50% less boilerplate code
3. **Type safety**: Single source of truth for all shared types
4. **AI-friendly**: Smaller, focused files easier for Cursor/Claude to work with
5. **Future-ready**: Clean extension points for git, templates, Expo Go

### To-dos

- [ ] Create centralized types in /types directory
- [ ] Extract magic values to /lib/constants.ts
- [ ] Create withAuth middleware and API response helpers
- [ ] Extract agent orchestration from generate-code-stream
- [ ] Extract useCodeGeneration and useProjectSession hooks
- [ ] Split ChatPanel into MessageList, ChatInput, etc.
- [ ] Refactor Zustand stores with persistence
- [ ] Create abstract ICodeStorage interface for git readiness