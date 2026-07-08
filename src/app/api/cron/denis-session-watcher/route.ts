import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { ensureSessionWatcherQStashSchedule } from "@/lib/denis/runtime/ensure-session-watcher-qstash-schedule";
import { runSessionWatcherTick } from "@/lib/denis/runtime/run-session-watcher";
import { runProactiveDailyJobs } from "@/lib/denis/runtime/run-proactive-daily-jobs";
import { runRhythmOpsJobs } from "@/lib/denis/runtime/run-rhythm-ops-jobs";
import { logger } from "@/lib/logger";
import { verifyQStashSignature } from "@/lib/queue/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NextRequest } from "next/server";

async function runWatcherTick(req: NextRequest) {
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
  return result;
}

/**
 * Vercel Hobby cron entry for this route was removed 2026-06-07 (blocked
 * sub-daily-cron deploys) and never replaced — see
 * ensure-session-watcher-qstash-schedule.ts. POST is the real trigger now,
 * called every minute by a self-provisioned QStash schedule. GET remains as
 * a manual/Vercel-cron-compatible fallback, same shape as jobs/outbox-process.
 */
export const POST = withErrorHandler(
  "cron-denis-session-watcher-post",
  async (req, _ctx) => {
    const limited = await withCronRateLimit(req);
    if (limited) return limited;

    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");
    const authorized =
      (cronSecret && auth === `Bearer ${cronSecret}`) ||
      (await verifyQStashSignature(req.clone()));

    if (!authorized) {
      return apiError("Unauthorized", 401);
    }

    ensureSessionWatcherQStashSchedule();

    const result = await runWatcherTick(req);
    return apiSuccess(result);
  }
);

export const GET = withErrorHandler(
  "cron-denis-session-watcher-get",
  async (req, _ctx) => {
    const limited = await withCronRateLimit(req);
    if (limited) return limited;

    if (!verifyCronSecret(req, process.env.CRON_SECRET)) {
      return apiError("Unauthorized", 401);
    }

    ensureSessionWatcherQStashSchedule();

    const result = await runWatcherTick(req);
    return apiSuccess(result);
  }
);
