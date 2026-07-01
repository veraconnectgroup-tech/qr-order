import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { runDailyPrepBriefingTick } from "@/lib/admin/run-daily-prep-briefing";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** Daily kitchen prep briefing — 06:00 UTC (Denis brifuje kuhinju pre smene). */
export const GET = withErrorHandler("cron-daily-prep-get", async (req, _ctx) => {
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
  const result = await runDailyPrepBriefingTick(admin, {
    limit: Number.isFinite(limit) ? limit : 50,
  });

  logger.info("Daily prep briefing cron completed", result);

  return apiSuccess(result);
});
