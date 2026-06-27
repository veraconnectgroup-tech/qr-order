import {
  type DegradationLevel,
  type DegradationHealthInput,
  type DegradationResolution,
  resolveDegradationLevel,
} from "@/lib/denis/config/degradation-ladder";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

export type StoredDegradationState = {
  level: DegradationLevel;
  levelSince: number;
  staffMessage: string;
  reason: string;
};

const STATE_TTL_SEC = 86_400;

function stateKey(locationId: string): string {
  return `denis:degradation:state:${locationId}`;
}

export async function loadStoredDegradationState(
  locationId: string
): Promise<StoredDegradationState | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(stateKey(locationId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredDegradationState;
  } catch (error) {
    logRedisDegradation("denis.degradation.state.read", error);
    return null;
  }
}

async function persistDegradationState(
  locationId: string,
  state: StoredDegradationState
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(stateKey(locationId), JSON.stringify(state), {
      ex: STATE_TTL_SEC,
    });
  } catch (error) {
    logRedisDegradation("denis.degradation.state.write", error);
  }
}

export async function applyDegradationTransition(input: {
  locationId: string;
  health: DegradationHealthInput;
  config: ConciergeConfig;
  now?: number;
}): Promise<{
  resolution: DegradationResolution;
  levelChanged: boolean;
  previousLevel: DegradationLevel | null;
}> {
  const now = input.now ?? Date.now();
  const previous = await loadStoredDegradationState(input.locationId);
  const currentLevel = previous?.level ?? "full";
  const levelSince = previous?.levelSince ?? now;

  const resolution = resolveDegradationLevel({
    health: input.health,
    currentLevel,
    levelSince,
    config: input.config,
    now,
  });

  const levelChanged = resolution.level !== currentLevel;

  await persistDegradationState(input.locationId, {
    level: resolution.level,
    levelSince: levelChanged ? now : levelSince,
    staffMessage: resolution.staffMessage,
    reason: resolution.reason,
  });

  return {
    resolution,
    levelChanged,
    previousLevel: previous?.level ?? null,
  };
}

export function healthMetricsToDegradationInput(metrics: {
  avgResponseMs: number;
  llmErrorRate: number;
  uptimePercent: number;
  activeSessionCount: number;
  stuckSessions: string[];
}): DegradationHealthInput {
  return {
    avgResponseMs: metrics.avgResponseMs,
    llmErrorRate: metrics.llmErrorRate,
    uptimePercent: metrics.uptimePercent,
    activeSessionCount: metrics.activeSessionCount,
    stuckSessions: metrics.stuckSessions,
  };
}
