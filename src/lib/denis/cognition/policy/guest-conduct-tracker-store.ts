import {
  emptyGuestConductTracker,
  type GuestConductTracker,
} from "@/lib/denis/cognition/policy/policy-decision-types";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const TRACKER_TTL_SEC = 86_400;

function trackerKey(aiSessionId: string): string {
  return `denis:conduct:${aiSessionId}`;
}

export async function loadGuestConductTracker(
  aiSessionId: string
): Promise<GuestConductTracker> {
  const redis = getRedisClient();
  if (!redis || !aiSessionId) return emptyGuestConductTracker(aiSessionId);

  try {
    const stored = await redis.get<GuestConductTracker>(trackerKey(aiSessionId));
    if (stored?.aiSessionId) return stored;
  } catch (error) {
    logRedisDegradation("denis.conduct.tracker.read", error);
  }

  return emptyGuestConductTracker(aiSessionId);
}

export async function saveGuestConductTracker(
  tracker: GuestConductTracker
): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !tracker.aiSessionId) return;

  try {
    await redis.set(trackerKey(tracker.aiSessionId), tracker, {
      ex: TRACKER_TTL_SEC,
    });
  } catch (error) {
    logRedisDegradation("denis.conduct.tracker.write", error);
  }
}
