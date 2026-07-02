import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { runWeeklyOwnerReportTick } from "@/lib/admin/run-daily-report";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** Weekly owner report — Sunday 20:00 UTC (ADR-043 S14). */
export const GET = withErrorHandler(
  "cron-weekly-owner-report-get",
  async (req, _ctx) => {
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
    const result = await runWeeklyOwnerReportTick(admin, {
      limit: Number.isFinite(limit) ? limit : 50,
    });

    logger.info("Weekly owner report tick completed", result);

    return apiSuccess(result);
  }
);
