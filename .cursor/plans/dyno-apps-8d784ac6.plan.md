<!-- 8d784ac6-c7bc-4221-b0a2-ed58ff46599b 07ac68ae-9946-4c16-af30-71c332986c64 -->
# Dyno Apps Codebase Refactoring Plan

## Current Issues

### 1. God Components with Mixed Concerns

**ChatPanel.tsx** - ✅ Refactored (242 lines, down from 722):

- SSE streaming logic extracted to `hooks/useCodeGeneration.ts`
- Project/sandbox initialization extracted to `hooks/useProjectSession.ts`
- Message rendering extracted to `components/builder/MessageList.tsx`
- Input handling extracted to `components/builder/ChatInput.tsx`
- Now a thin orchestrator component

**BuilderPage** - ✅ Refactored (160 lines, down from 383):

- Project loading extracted to `hooks/useProjectLoader.ts`
- Header with name editing extracted to `components/builder/ProjectHeader.tsx`
- Sandbox validation logic simplified in hook

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

| Phase | Effort | Impact | Status |

|-------|--------|--------|--------|

| Phase 1 | Low | High | ✅ Complete |

| Phase 2 | Medium | High | ✅ Complete |

| Phase 3 | High | High | ✅ Complete |

| Phase 4 | Medium | Medium | Pending |

| Phase 5 | Medium | Medium | Pending |

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

1. **ChatPanel**: 722 lines to 242 lines (66% reduction, orchestrator only)
2. **API routes**: ~50% less boilerplate code
3. **Type safety**: Single source of truth for all shared types
4. **AI-friendly**: Smaller, focused files easier for Cursor/Claude to work with
5. **Future-ready**: Clean extension points for git, templates, Expo Go

#### Phase 1 ✅ Complete (commit 843d67a)

- [x] Create centralized types in /types directory
- [x] Extract magic values to /lib/constants.ts

#### Phase 2 ✅ Complete (commit 7af3308)

- [x] Create withAuth middleware and API response helpers
- [x] Extract agent orchestration from generate-code-stream
- [x] Refactor API routes to use middleware (projects, sandbox routes)

#### Phase 3 ✅ Complete

- [x] Extract useCodeGeneration hook - SSE streaming logic (312 lines)
- [x] Extract useProjectSession hook - project/sandbox initialization (131 lines)
- [x] Extract MessageList component - message rendering (84 lines)
- [x] Extract ChatInput component - input handling (50 lines)
- [x] Refactor ChatPanel to use extracted hooks and components (242 lines, 66% reduction)
- [x] Extract useProjectLoader hook - project loading from URL params (137 lines)
- [x] Extract ProjectHeader component - header with name editing (152 lines)
- [x] Refactor BuilderPage to use extracted hook and component (160 lines, 58% reduction)

#### Phase 4 ✅ Complete

- [x] Split stores into separate files (`lib/stores/auth-store.ts`, `lib/stores/builder-store.ts`)
- [x] Create persistence layer (`lib/stores/persist.ts`) with localStorage/sessionStorage support
- [x] Add Date serialization/deserialization for persisted state
- [x] Add session state tracking (modified files, message history, sandbox health status)
- [x] Update `lib/store.ts` to re-export stores for backward compatibility

#### Phase 5

- [ ] Create abstract ICodeStorage interface for git readiness