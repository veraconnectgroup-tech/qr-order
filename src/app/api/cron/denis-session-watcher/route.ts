import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { runSessionWatcherTick } from "@/lib/denis/runtime/run-session-watcher";
import { runProactiveDailyJobs } from "@/lib/denis/runtime/run-proactive-daily-jobs";
import { runRhythmOpsJobs } from "@/lib/denis/runtime/run-rhythm-ops-jobs";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "cron-denis-session-watcher-get",
  async (req, _ctx) => {
    if (!verifyCronSecret(req, process.env.CRON_SECRET)) {
      return apiError("Unauthorized", 401);
    }

    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 80;

    const admin = createAdminClient();
    const [watcher, daily, rhythmOps] = await Promise.all([
      runSessionWatcherTick(admin, {
        limit: Number.isFinite(limit) ? limit : 80,
      }),
      runProactiveDailyJobs(admin),
      runRhythmOpsJobs(admin),
    ]);

    const result = { watcher, daily, rhythmOps };
    logger.info("Denis session watcher tick completed", result);

    return apiSuccess(result);
  }
);
