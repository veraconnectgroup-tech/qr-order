import { after } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Runs `fn` durably after the response is sent, via Next's `after()`, so a
 * serverless instance isn't frozen mid-write on fire-and-forget background
 * work (shadow traces, audit entries, timeline writes). `after()` only
 * works inside a request-scoped context (route handlers, server
 * functions) — callers reached from non-request contexts (outbox/queue
 * workers, cron) fall back to a plain unawaited call.
 */
export function runAfterResponse(fn: () => Promise<void>): void {
  try {
    after(fn);
  } catch (error) {
    logger.info("runAfterResponse: no request scope, falling back", {
      error: error instanceof Error ? error.message : String(error),
    });
    void fn();
  }
}
