import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { runActionableInsightsTick } from "@/lib/dashboard/run-actionable-insights-tick";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** Owner actionable insights — morning digest + critical push (07:00 UTC). */
export const GET = withErrorHandler("cron-actionable-insights-get", async (req) => {
  const limited = await withCronRateLimit(req);
  if (limited) return limited;

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401);
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;

  const admin = createAdminClient();
  const result = await runActionableInsightsTick(admin, {
    limit: Number.isFinite(limit) ? limit : 50,
  });

  logger.info("Actionable insights cron completed", result);

  return apiSuccess(result);
});
