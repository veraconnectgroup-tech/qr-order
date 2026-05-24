import { enqueue } from "@/lib/queue/client";
import { ensureOutboxQStashSchedule } from "@/lib/outbox/ensure-qstash-schedule";
import { logger } from "@/lib/logger";

/** Wake outbox worker after enqueue — fire-and-forget. */
export function scheduleOutboxProcess() {
  ensureOutboxQStashSchedule();

  void enqueue("/api/jobs/outbox-process", {}, { retries: 3 }).catch((err) => {
    logger.error("Outbox process enqueue failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
