import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { runWeeklyNudgeDigestTick } from "@/lib/admin/run-weekly-nudge-digest";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** Weekly Denis nudge performance digest — Monday 07:00 UTC (ADR-039 L4). */
export const GET = withErrorHandler("cron-denis-nudge-digest-get", async (req, _ctx) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401);
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;

  const admin = createAdminClient();
  const result = await runWeeklyNudgeDigestTick(admin, {
    limit: Number.isFinite(limit) ? limit : 50,
    periodDays: 7,
  });

  logger.info("Denis weekly nudge digest completed", result);

  return apiSuccess(result);
});
