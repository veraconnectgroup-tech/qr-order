import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { runDenisExperienceScoreTick } from "@/lib/admin/run-denis-experience-score";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** Daily Denis experience score — 02:00 UTC (Layer 11 AI2). */
export const GET = withErrorHandler(
  "cron-denis-experience-score-get",
  async (req, _ctx) => {
    const limited = await withCronRateLimit(req);
    if (limited) return limited;

    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");

    if (!secret || auth !== `Bearer ${secret}`) {
      return apiError("Unauthorized", 401);
    }

    const metricDate = req.nextUrl.searchParams.get("date") ?? undefined;
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const admin = createAdminClient();
    const result = await runDenisExperienceScoreTick(admin, {
      metricDate,
      limit: Number.isFinite(limit ?? NaN) ? limit : undefined,
    });

    logger.info("Denis experience score tick completed", result);

    return apiSuccess(result);
  }
);
