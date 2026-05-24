import { qstash } from "@/lib/queue/client";
import { logger } from "@/lib/logger";

const OUTBOX_SCHEDULE_ID = "qr-order-outbox-process";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

let ensurePromise: Promise<void> | null = null;

/**
 * Hobby Vercel cannot run sub-daily crons — outbox polling uses QStash schedules instead.
 * Idempotent: safe to call on every enqueue / worker invocation.
 */
export function ensureOutboxQStashSchedule(): void {
  if (!qstash || process.env.NODE_ENV === "test") return;

  if (!ensurePromise) {
    ensurePromise = doEnsure().catch((err) => {
      ensurePromise = null;
      logger.error("Outbox QStash schedule ensure failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

async function doEnsure(): Promise<void> {
  const destination = `${appUrl()}/api/jobs/outbox-process`;

  const schedules = await qstash!.schedules.list();
  const exists = schedules.some(
    (s) =>
      s.scheduleId === OUTBOX_SCHEDULE_ID ||
      s.destination === destination
  );

  if (exists) return;

  await qstash!.schedules.create({
    destination,
    cron: "* * * * *",
    scheduleId: OUTBOX_SCHEDULE_ID,
  });

  logger.info("Outbox QStash schedule created", {
    destination,
    cron: "* * * * *",
  });
}
