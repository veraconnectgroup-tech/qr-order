import type { WaitlistEntry } from "@/lib/denis/commerce/waitlist";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const QUEUE_TTL_SEC = 86_400;

function queueKey(locationId: string): string {
  return `denis:waitlist:${locationId}`;
}

export async function loadWaitlistEntries(
  locationId: string
): Promise<WaitlistEntry[]> {
  const redis = getRedisClient();
  if (!redis || !locationId) return [];

  try {
    const stored = await redis.get<WaitlistEntry[]>(queueKey(locationId));
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    logRedisDegradation("denis.waitlist.read", error);
    return [];
  }
}

export async function saveWaitlistEntries(
  locationId: string,
  entries: WaitlistEntry[]
): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !locationId) return;

  try {
    await redis.set(queueKey(locationId), entries, { ex: QUEUE_TTL_SEC });
  } catch (error) {
    logRedisDegradation("denis.waitlist.write", error);
  }
}

export async function appendWaitlistEntry(
  locationId: string,
  entry: WaitlistEntry
): Promise<WaitlistEntry[]> {
  const existing = await loadWaitlistEntries(locationId);
  const next = [...existing, entry];
  await saveWaitlistEntries(locationId, next);
  return next;
}

export async function updateWaitlistEntries(
  locationId: string,
  updater: (entries: WaitlistEntry[]) => WaitlistEntry[]
): Promise<WaitlistEntry[]> {
  const existing = await loadWaitlistEntries(locationId);
  const next = updater(existing);
  await saveWaitlistEntries(locationId, next);
  return next;
}
