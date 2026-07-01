import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { runStaffTrainingAlertsTick } from "@/lib/admin/run-staff-training-alerts";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** Weekly staff training alert digest — Denis flags training gaps for owners. */
export const GET = withErrorHandler("cron-staff-training-get", async (req, _ctx) => {
  const limited = await withCronRateLimit(req);
  if (limited) return limited;

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401);
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;
  const periodDaysParam = req.nextUrl.searchParams.get("periodDays");
  const periodDays = periodDaysParam ? Number(periodDaysParam) : 7;

  const admin = createAdminClient();
  const result = await runStaffTrainingAlertsTick(admin, {
    limit: Number.isFinite(limit) ? limit : 50,
    periodDays: Number.isFinite(periodDays) ? periodDays : 7,
  });

  logger.info("Staff training cron completed", result);

  return apiSuccess(result);
});
