import { getRedisClient } from "@/lib/redis/client";
import { logger } from "@/lib/logger";

/** Dev-only fallback when Upstash is not configured locally. */
const devMemoryCache = new Map<string, { pin: string; expiresAt: number }>();

const TTL_SECONDS = 10 * 60;
const KEY_PREFIX = "pin-reveal:";

function isDevMemoryFallbackEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !getRedisClient();
}

function devMemoryKey(orderId: string) {
  return `${KEY_PREFIX}${orderId}`;
}

export async function storePinReveal(orderId: string, pin: string): Promise<void> {
  if (!pin) return;

  const redis = getRedisClient();
  if (redis) {
    await redis.set(`${KEY_PREFIX}${orderId}`, pin, { ex: TTL_SECONDS });
    return;
  }

  if (isDevMemoryFallbackEnabled()) {
    devMemoryCache.set(devMemoryKey(orderId), {
      pin,
      expiresAt: Date.now() + TTL_SECONDS * 1000,
    });
    return;
  }

  logger.error("PIN reveal store failed — Redis not configured", { orderId });
}

/** Atomic consume — Redis GETDEL (production); dev memory fallback for local only. */
export async function consumePinReveal(orderId: string): Promise<string | null> {
  const redis = getRedisClient();
  if (redis) {
    const pin = await redis.getdel<string>(`${KEY_PREFIX}${orderId}`);
    return pin ?? null;
  }

  if (isDevMemoryFallbackEnabled()) {
    const entry = devMemoryCache.get(devMemoryKey(orderId));
    if (!entry) return null;
    devMemoryCache.delete(devMemoryKey(orderId));
    if (Date.now() > entry.expiresAt) return null;
    return entry.pin;
  }

  logger.error("PIN reveal consume failed — Redis not configured", { orderId });
  return null;
}

/** Test helper — dev memory fallback only. */
export function clearPinRevealMemoryCache() {
  devMemoryCache.clear();
}
