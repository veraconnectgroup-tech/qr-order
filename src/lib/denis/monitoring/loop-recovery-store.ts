import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const RECOVERY_TTL_SEC = 3_600;

function recoveryKey(sessionId: string): string {
  return `denis:loop:recovery:${sessionId}`;
}

export async function getLoopRecoveryAttempts(
  sessionId: string
): Promise<number> {
  const redis = getRedisClient();
  if (!redis || !sessionId) return 0;

  try {
    const raw = await redis.get<number>(recoveryKey(sessionId));
    return typeof raw === "number" ? raw : Number(raw) || 0;
  } catch (error) {
    logRedisDegradation("denis.loop.recovery.read", error);
    return 0;
  }
}

export async function incrementLoopRecoveryAttempts(
  sessionId: string
): Promise<number> {
  const redis = getRedisClient();
  if (!redis || !sessionId) return 0;

  try {
    const key = recoveryKey(sessionId);
    const next = await redis.incr(key);
    await redis.expire(key, RECOVERY_TTL_SEC);
    return typeof next === "number" ? next : Number(next) || 0;
  } catch (error) {
    logRedisDegradation("denis.loop.recovery.incr", error);
    return 0;
  }
}

export async function clearLoopRecoveryAttempts(
  sessionId: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !sessionId) return;

  try {
    await redis.del(recoveryKey(sessionId));
  } catch (error) {
    logRedisDegradation("denis.loop.recovery.clear", error);
  }
}
