import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";
import { actorDedupeKey } from "@/lib/denis/actor/redis-keys";

const DEDUPE_TTL_SEC = 86_400;

/** Returns true if this signalId is new (should process). False = duplicate. */
export async function claimSignalId(signalId: string): Promise<boolean> {
  const redis = getAiRedis();
  if (!redis) return true;

  try {
    const result = await redis.set(actorDedupeKey(signalId), "1", {
      nx: true,
      ex: DEDUPE_TTL_SEC,
    });
    return result === "OK";
  } catch (error) {
    logRedisDegradation(`actor:dedupe:${signalId}`, error);
    return true;
  }
}
