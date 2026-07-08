import { qstash } from "@/lib/queue/client";
import { logger } from "@/lib/logger";

const SESSION_WATCHER_SCHEDULE_ID = "qr-order-denis-session-watcher";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

let ensurePromise: Promise<void> | null = null;

/**
 * Vercel Hobby cannot run sub-daily crons — this route's "* * * * *" entry
 * was removed from vercel.json on 2026-06-07 to unblock deploys, and never
 * given a replacement trigger (see src/lib/outbox/ensure-qstash-schedule.ts
 * for the same fix applied to outbox-process on 2026-05-24). Since then,
 * runSessionWatcherTick / runProactiveDailyJobs / runRhythmOpsJobs have not
 * run at all — no staff proactive delay alerts, no daily proactive jobs, no
 * rhythm-ops rollups. This restores the minute-level trigger via QStash.
 * Idempotent: safe to call on every invocation.
 */
export function ensureSessionWatcherQStashSchedule(): void {
  if (!qstash || process.env.NODE_ENV === "test") return;

  if (!ensurePromise) {
    ensurePromise = doEnsure().catch((err) => {
      ensurePromise = null;
      logger.error("Denis session watcher QStash schedule ensure failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

async function doEnsure(): Promise<void> {
  const destination = `${appUrl()}/api/cron/denis-session-watcher`;

  const schedules = await qstash!.schedules.list();
  const exists = schedules.some(
    (s) =>
      s.scheduleId === SESSION_WATCHER_SCHEDULE_ID ||
      s.destination === destination
  );

  if (exists) return;

  await qstash!.schedules.create({
    destination,
    cron: "* * * * *",
    scheduleId: SESSION_WATCHER_SCHEDULE_ID,
  });

  logger.info("Denis session watcher QStash schedule created", {
    destination,
    cron: "* * * * *",
  });
}
