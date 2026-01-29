import { withAuth, successResponse } from "@/lib/server/api-utils";
import { getUserCredits } from "@/lib/server/creditsStore";

/**
 * GET /api/user/credits
 * Returns the current user's credit balance
 */
export const GET = withAuth(async (request, user) => {
  const credits = await getUserCredits(user.id);

  return successResponse({
    balance: credits.balance,
    totalCreditsAdded: credits.totalCreditsAdded,
    totalCreditsUsed: credits.totalCreditsUsed,
  });
});
