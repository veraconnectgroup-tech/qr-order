import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { runDenisPilotTick } from "@/lib/denis/runtime/run-denis-pilot-tick";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export const GET = withErrorHandler("cron-denis-pilot-tick-get", async (req, _ctx) => {
  if (!verifyCronSecret(req, process.env.CRON_SECRET)) {
    return apiError("Unauthorized", 401);
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 80;

  const admin = createAdminClient();
  const result = await runDenisPilotTick(admin, {
    sessionLimit: Number.isFinite(limit) ? limit : 80,
    floorLimit: Number.isFinite(limit) ? limit : 50,
    schedulerLimit: Number.isFinite(limit) ? limit : 50,
    learnedLimit: Number.isFinite(limit) ? limit : 50,
  });

  logger.info("Denis pilot tick completed", {
    watcherScanned: result.sessionWatcher.scanned,
    floorRefreshed: result.floor.refreshed,
    schedulerEmitted: result.scheduler.emitted,
  });

  return apiSuccess(result);
});
