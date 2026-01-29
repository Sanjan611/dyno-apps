# Credits System Implementation Plan

## Overview

Implement a credits system where:
- Credits are tied to API cost with configurable margin (default 100%)
- $1 marked up = 10 credits
- Formula: `credits = rawCost × (1 + margin%) × 10`

Example: $0.05 raw API cost → $0.10 marked up (100% margin) → 1 credit consumed

---

## 1. Database Schema

### Migration: `20260130000001_add_user_credits.sql`

```sql
CREATE TABLE public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(12, 4) NOT NULL DEFAULT 0,
  total_credits_added DECIMAL(12, 4) NOT NULL DEFAULT 0,
  total_credits_used DECIMAL(12, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can only read their own credits
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credits" ON public.user_credits
  FOR SELECT USING (user_id = auth.uid());
```

---

## 2. Credits Store

**File:** `lib/server/creditsStore.ts`

Key functions (follow pattern from `userLimitsStore.ts`):

```typescript
// Constants
const CREDITS_PER_DOLLAR = 10;
const DEFAULT_MARGIN_PERCENTAGE = 100;
const DEFAULT_INITIAL_CREDITS = 10;

// Get margin from env var CREDIT_MARGIN_PERCENTAGE or default
function getMarginPercentage(): number

// Convert raw cost to credits
function calculateCreditsFromCost(rawCostUsd: number): number {
  const margin = getMarginPercentage();
  const markedUpCost = rawCostUsd * (1 + margin / 100);
  return markedUpCost * CREDITS_PER_DOLLAR;
}

// Get user credits (auto-create with initial credits if not exists)
async function getUserCredits(userId: string): Promise<UserCredits>

// Deduct credits after agent run
async function deductCredits(
  userId: string,
  rawCostUsd: number,
  projectId: string
): Promise<{ success: boolean; newBalance: number }>

// Admin: add credits to user
async function addCredits(
  userId: string,
  amount: number
): Promise<{ newBalance: number }>
```

---

## 3. Integration Points

### Pre-flight Check (block if no credits)

**File:** `app/api/projects/[id]/chat/route.ts`

Add after auth check, before triggering agent:

```typescript
// Check user has credits
const credits = await getUserCredits(user.id);
if (credits.balance <= 0) {
  return Response.json(
    { error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" },
    { status: 402 }
  );
}
```

### Post-run Deduction

**File:** `lib/server/coding-agent.ts`

After `recordTokenUsageBatch()` calls (lines ~431, ~451, ~489), add:

```typescript
// Calculate total raw cost from this run
const totalRawCost = tokenUsageRecords.reduce((sum, r) => sum + r.costUsd, 0);
if (totalRawCost > 0) {
  await deductCredits(userId, totalRawCost, projectId);
}
```

Same pattern for:
- `trigger/coding-agent.ts`
- `trigger/ask-agent.ts`

---

## 4. Admin API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/credits` | GET | List all users with credit balances |
| `/api/admin/credits/[userId]/topup` | POST | Add credits to user |

---

## 5. User API Route

**File:** `app/api/user/credits/route.ts`

```typescript
// GET - Returns current user's credit balance
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const credits = await getUserCredits(user.id);
  return Response.json({ balance: credits.balance });
}
```

---

## 6. Frontend Changes

### Credit Balance Display

**File:** `components/builder/ProjectHeader.tsx`

Add credit balance indicator next to "My Projects" button:
```tsx
<div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded">
  <CoinsIcon className="w-4 h-4 text-amber-500" />
  <span className="text-sm">{credits.toFixed(1)}</span>
</div>
```

### Hook

**File:** `hooks/useUserCredits.ts`

Fetch and cache user's credit balance, with refetch capability.

### Handle Insufficient Credits

**File:** `hooks/useCodeGeneration.ts`

Check for `INSUFFICIENT_CREDITS` error code and show appropriate UI (modal/toast).

---

## 7. Admin UI

**File:** `app/admin/page.tsx`

Add a "Credits" tab alongside existing "Waitlist" tab:
- User list with search (email, balance, total used)
- "Add Credits" button per user → modal with amount input

---

## 8. Environment Variables

Add to `.env.local.example`:
```bash
CREDIT_MARGIN_PERCENTAGE=100  # 100 = 2x markup (raw $1 → $2 marked up)
INITIAL_CREDITS=10            # Credits given to new users
```

---

## 9. Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260130000001_add_user_credits.sql` | user_credits table |
| `lib/server/creditsStore.ts` | Credit balance management |
| `app/api/user/credits/route.ts` | User's own credits endpoint |
| `app/api/admin/credits/route.ts` | Admin list users |
| `app/api/admin/credits/[userId]/topup/route.ts` | Admin add credits |
| `hooks/useUserCredits.ts` | Frontend credit fetching |

## 10. Files to Modify

| File | Change |
|------|--------|
| `app/api/projects/[id]/chat/route.ts` | Pre-flight credit check |
| `lib/server/coding-agent.ts` | Post-run credit deduction |
| `trigger/coding-agent.ts` | Post-run credit deduction |
| `trigger/ask-agent.ts` | Post-run credit deduction |
| `components/builder/ProjectHeader.tsx` | Credit balance display |
| `hooks/useCodeGeneration.ts` | Handle INSUFFICIENT_CREDITS |
| `app/admin/page.tsx` | Add Credits tab |
| `.env.local.example` | Add new env vars |

---

## 11. Edge Cases

1. **User goes negative mid-run**: Allow current run to complete, deduct full cost (may go negative), block future runs until topped up
2. **Race conditions**: Use database transaction with `SELECT ... FOR UPDATE` in `deductCredits()`
3. **New users**: Auto-create `user_credits` record with `INITIAL_CREDITS` (10 credits) on first access
4. **Existing users**: Manually top up via database (no auto-initialization for existing users)

---

## 12. Verification

1. **Database**: Run `supabase db push` and verify table created
2. **Credits deduction**: Make an agent request, check `user_credits.balance` decreased
3. **Pre-flight check**: Set balance to 0, verify 402 response with `INSUFFICIENT_CREDITS`
4. **Admin topup**: Use admin API to add credits, verify balance increases
5. **UI**: Verify credit balance displays in header and updates after agent runs

---

## Future Enhancements (Not in Scope)

- Credit transaction history (consider ClickHouse for this)
- User-facing transaction log
- Self-service credit purchases
