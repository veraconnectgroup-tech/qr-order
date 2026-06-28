import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const OFFERED_TTL_SEC = 86_400;

function offeredKey(sessionId: string): string {
  return `denis:promo:offered:${sessionId}`;
}

export async function wasPromoOfferedInSession(
  sessionId: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis || !sessionId) return false;

  try {
    const value = await redis.get<string>(offeredKey(sessionId));
    return Boolean(value);
  } catch (error) {
    logRedisDegradation("denis.promo.offered.read", error);
    return false;
  }
}

export async function markPromoOfferedInSession(
  sessionId: string,
  code: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !sessionId) return;

  try {
    await redis.set(offeredKey(sessionId), code, { ex: OFFERED_TTL_SEC });
  } catch (error) {
    logRedisDegradation("denis.promo.offered.write", error);
  }
}
