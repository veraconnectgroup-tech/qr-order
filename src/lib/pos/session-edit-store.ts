import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";

const KEY_PREFIX = "pos:staff-edit:";
export const POS_STAFF_EDIT_TTL_SECONDS = 15;

function redisKey(tableSessionId: string): string {
  return `${KEY_PREFIX}${tableSessionId}`;
}

/** Mark that POS/staff is actively editing the table order (Prompt 39). */
export async function markPosStaffEdit(
  tableSessionId: string,
  ttlSeconds = POS_STAFF_EDIT_TTL_SECONDS
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.set(redisKey(tableSessionId), "1", { ex: ttlSeconds });
  } catch (error) {
    logRedisDegradation(`pos-staff-edit:mark:${tableSessionId}`, error);
  }
}

export async function isPosStaffEditActive(
  tableSessionId: string
): Promise<boolean> {
  const redis = getAiRedis();
  if (!redis) return false;

  try {
    const value = await redis.get<string>(redisKey(tableSessionId));
    return value === "1";
  } catch (error) {
    logRedisDegradation(`pos-staff-edit:read:${tableSessionId}`, error);
    return false;
  }
}

export async function clearPosStaffEdit(tableSessionId: string): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.del(redisKey(tableSessionId));
  } catch (error) {
    logRedisDegradation(`pos-staff-edit:clear:${tableSessionId}`, error);
  }
}
