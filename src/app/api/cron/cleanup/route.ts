import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

const STALE_SESSION_HOURS = 24;
const WEBHOOK_RETENTION_DAYS = 30;

export const GET = withErrorHandler("cron-cleanup-get", async (req, _ctx) => {
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
    const { error: closeError } = await admin
      .from("table_sessions")
      .update({
        status: "closed",
        closed_at: now.toISOString(),
      })
      .in("id", staleIds);

    if (closeError) {
      logger.error("Cron session cleanup update failed", {
        error: closeError.message,
      });
      return apiError("Session cleanup failed", 500);
    }

    sessionsClosed = staleIds.length;
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

  logger.info("Cron cleanup completed", {
    sessionsClosed,
    webhookCutoff,
  });

  return apiSuccess({
    sessionsClosed,
    webhookEventsPurgedBefore: webhookCutoff,
  });
});
