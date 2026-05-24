import * as Sentry from "@sentry/nextjs";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

let client: Redis | null | undefined;

export function getRedisClient(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    client = null;
    return client;
  }

  client = new Redis({ url, token });
  return client;
}

/** Log Redis degradation and allow callers to fail open. */
export function logRedisDegradation(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logger.warn(`Redis unavailable (${context}), degrading gracefully`, {
    error: message,
  });

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(`Redis unavailable: ${context}`, {
      level: "warning",
      extra: { error: message },
    });
  }
}
