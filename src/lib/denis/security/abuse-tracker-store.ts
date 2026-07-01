import type { AbuseTracker } from "@/lib/denis/security/abuse-protection";
import { emptyAbuseTracker } from "@/lib/denis/security/abuse-protection";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const TRACKER_TTL_SEC = 86_400;

function trackerKey(sessionId: string): string {
  return `denis:abuse:${sessionId}`;
}

function ipSessionsKey(ip: string): string {
  return `denis:abuse:ip:${ip}`;
}

export async function loadAbuseTracker(sessionId: string): Promise<AbuseTracker> {
  const redis = getRedisClient();
  if (!redis || !sessionId) return emptyAbuseTracker(sessionId);

  try {
    const stored = await redis.get<AbuseTracker>(trackerKey(sessionId));
    if (stored?.sessionId) return stored;
  } catch (error) {
    logRedisDegradation("denis.abuse.tracker.read", error);
  }

  return emptyAbuseTracker(sessionId);
}

export async function saveAbuseTracker(tracker: AbuseTracker): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !tracker.sessionId) return;

  try {
    await redis.set(trackerKey(tracker.sessionId), tracker, { ex: TRACKER_TTL_SEC });
  } catch (error) {
    logRedisDegradation("denis.abuse.tracker.write", error);
  }
}

/** Per-IP session creation guard — max 100 sessions/hour. */
export async function checkIpSessionBudget(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return true;

  const redis = getRedisClient();
  if (!redis) return true;

  const key = ipSessionsKey(ip);
  const windowSec = 3600;
  const limit = 100;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSec);
    }
    return count <= limit;
  } catch (error) {
    logRedisDegradation("denis.abuse.ip.read", error);
    return true;
  }
}
