import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";
import { viewVersionKey } from "@/lib/denis/actor/redis-keys";

const VIEW_VERSION_TTL_SEC = 86_400;

export async function publishViewVersionBump(
  tableSessionId: string,
  version: number
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.set(viewVersionKey(tableSessionId), String(version), {
      ex: VIEW_VERSION_TTL_SEC,
    });
  } catch (error) {
    logRedisDegradation(`view:version:publish:${tableSessionId}`, error);
  }
}

export async function readViewVersionBump(
  tableSessionId: string
): Promise<number | null> {
  const redis = getAiRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(viewVersionKey(tableSessionId));
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (error) {
    logRedisDegradation(`view:version:read:${tableSessionId}`, error);
    return null;
  }
}
