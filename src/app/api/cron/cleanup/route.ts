import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { DATA_RETENTION, retentionCutoffIso } from "@/lib/data-retention";
import { runMemoryRetentionSweep } from "@/lib/denis/memory/memory-retention";
import { sweepOpenCashSessions } from "@/lib/loss-prevention/sweep-open-cash-sessions";
import { logger } from "@/lib/logger";
import { closeTableSession } from "@/lib/sessions/session-devices";
import { createAdminClient } from "@/lib/supabase/admin";

const STALE_SESSION_HOURS = 24;
const WEBHOOK_RETENTION_DAYS = 30;

/** GoBD: never purge fiscal journal tables here — see docs/compliance/gobd-retention.md */

export const GET = withErrorHandler("cron-cleanup-get", async (req, _ctx) => {
  const limited = await withCronRateLimit(req);
  if (limited) return limited;

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401);
  }

  const admin = createAdminClient();
  const now = new Date();
  const sessionCutoff = new Date(
    now.getTime() - STALE_SESSION_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: staleSessions, error: fetchError } = await admin
    .from("table_sessions")
    .select("id")
    .eq("status", "active")
    .lt("opened_at", sessionCutoff);

  if (fetchError) {
    logger.error("Cron session cleanup fetch failed", {
      error: fetchError.message,
    });
    return apiError("Session cleanup failed", 500);
  }

  const staleIds = (staleSessions ?? []).map(
    (row) => (row as { id: string }).id
  );
  let sessionsClosed = 0;

  if (staleIds.length > 0) {
    for (const sessionId of staleIds) {
      try {
        await closeTableSession(admin, sessionId, "void");
        sessionsClosed += 1;
      } catch (error) {
        logger.error("Cron session cleanup close failed", {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        return apiError("Session cleanup failed", 500);
      }
    }
  }

  const webhookCutoff = new Date(
    now.getTime() - WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: webhookError } = await admin
    .from("webhook_events")
    .delete()
    .lt("processed_at", webhookCutoff);

  if (webhookError) {
    logger.error("Cron webhook cleanup failed", {
      error: webhookError.message,
    });
    return apiError("Webhook cleanup failed", 500);
  }

  const traceCutoff = retentionCutoffIso(DATA_RETENTION.turnTraces.days, now);
  const { error: traceError } = await admin
    .from("denis_turn_traces")
    .delete()
    .lt("created_at", traceCutoff);

  if (traceError) {
    logger.error("Cron turn trace cleanup failed", {
      error: traceError.message,
    });
    return apiError("Turn trace cleanup failed", 500);
  }

  let memoryRetentionSummary = null as Awaited<
    ReturnType<typeof runMemoryRetentionSweep>
  > | null;

  let cashSessionSweep = { scanned: 0, flagged: 0 };

  try {
    memoryRetentionSummary = await runMemoryRetentionSweep(admin, now);
  } catch (retentionError) {
    logger.error("Memory retention sweep failed", {
      error:
        retentionError instanceof Error
          ? retentionError.message
          : String(retentionError),
    });
    return apiError("Memory retention sweep failed", 500);
  }

  try {
    cashSessionSweep = await sweepOpenCashSessions(admin, {
      openMinutesThreshold: 120,
      now,
    });
  } catch (cashSweepError) {
    logger.error("Open cash session sweep failed", {
      error:
        cashSweepError instanceof Error
          ? cashSweepError.message
          : String(cashSweepError),
    });
  }

  logger.info("Cron cleanup completed", {
    sessionsClosed,
    webhookCutoff,
    traceCutoff,
    memoryRetention: memoryRetentionSummary.processed,
    cashSessionSweep,
  });

  return apiSuccess({
    sessionsClosed,
    webhookEventsPurgedBefore: webhookCutoff,
    turnTracesPurgedBefore: traceCutoff,
    memoryRetention: memoryRetentionSummary,
    cashSessionSweep,
  });
});
