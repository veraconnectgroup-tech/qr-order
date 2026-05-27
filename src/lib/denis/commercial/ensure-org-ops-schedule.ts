import { qstash } from "@/lib/queue/client";
import { logger } from "@/lib/logger";

const ORG_AI_OPS_SCHEDULE_ID = "qr-order-org-ai-ops-refresh";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

let ensurePromise: Promise<void> | null = null;

/**
 * Hobby Vercel cannot run sub-daily crons — org_ai_ops refresh uses QStash (ADR-009 F5).
 */
export function ensureOrgAiOpsQStashSchedule(): void {
  if (!qstash || process.env.NODE_ENV === "test") return;

  if (!ensurePromise) {
    ensurePromise = doEnsure().catch((err) => {
      ensurePromise = null;
      logger.error("Org AI ops QStash schedule ensure failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

async function doEnsure(): Promise<void> {
  const destination = `${appUrl()}/api/jobs/refresh-org-ai-ops`;

  const schedules = await qstash!.schedules.list();
  const exists = schedules.some(
    (s) =>
      s.scheduleId === ORG_AI_OPS_SCHEDULE_ID || s.destination === destination
  );

  if (exists) return;

  await qstash!.schedules.create({
    destination,
    cron: "*/15 * * * *",
    scheduleId: ORG_AI_OPS_SCHEDULE_ID,
  });

  logger.info("Org AI ops QStash schedule created", {
    destination,
    cron: "*/15 * * * *",
  });
}
