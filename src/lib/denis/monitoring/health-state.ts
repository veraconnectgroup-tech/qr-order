import type { HealthStatus } from "@/lib/denis/monitoring/denis-health";
import {
  HEALTH_DEGRADED_PROACTIVE_MS,
  type DenisHealthEvaluation,
} from "@/lib/denis/monitoring/denis-health";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

export type HealthFeatureLevel = "full" | "reduced" | "minimal";

export type StoredHealthState = {
  status: HealthStatus;
  statusSince: number;
  featureLevel: HealthFeatureLevel;
  lastAlertAt: number | null;
};

const STATE_TTL_SEC = 86_400;

const RECOVERY_STABLE_MS: Record<HealthStatus, number> = {
  healthy: 0,
  degraded: HEALTH_DEGRADED_PROACTIVE_MS,
  critical: 3 * 60_000,
};

function stateKey(locationId: string): string {
  return `denis:health:state:${locationId}`;
}

function featureLevelForStatus(status: HealthStatus): HealthFeatureLevel {
  if (status === "critical") return "minimal";
  if (status === "degraded") return "reduced";
  return "full";
}

export async function loadStoredHealthState(
  locationId: string
): Promise<StoredHealthState | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(stateKey(locationId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredHealthState;
  } catch (error) {
    logRedisDegradation("denis.health.state.read", error);
    return null;
  }
}

async function persistHealthState(
  locationId: string,
  state: StoredHealthState
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(stateKey(locationId), JSON.stringify(state), {
      ex: STATE_TTL_SEC,
    });
  } catch (error) {
    logRedisDegradation("denis.health.state.write", error);
  }
}

/**
 * Track status transitions with hysteresis — recovery is slower than degradation.
 * Returns whether proactive frequency should be reduced (degraded > 5 min).
 */
export async function applyHealthStateTransition(
  locationId: string,
  evaluation: DenisHealthEvaluation,
  now = Date.now()
): Promise<{
  reduceProactive: boolean;
  gradualRestore: boolean;
  statusChanged: boolean;
  previousStatus: HealthStatus | null;
}> {
  const previous = await loadStoredHealthState(locationId);
  const previousStatus = previous?.status ?? null;
  const statusChanged = previousStatus !== evaluation.status;

  let featureLevel = featureLevelForStatus(evaluation.status);
  let reduceProactive = false;
  let gradualRestore = false;

  if (
    previous &&
    evaluation.status === "healthy" &&
    previous.status !== "healthy"
  ) {
    const stableMs = now - previous.statusSince;
    const requiredMs = RECOVERY_STABLE_MS[previous.status];
    if (stableMs < requiredMs) {
      // Hold previous degraded level until stable window passes
      featureLevel = previous.featureLevel;
      reduceProactive = previous.featureLevel !== "full";
    } else {
      gradualRestore = previous.featureLevel !== "full";
      if (previous.featureLevel === "minimal") {
        featureLevel = "reduced";
      } else if (previous.featureLevel === "reduced") {
        featureLevel = "full";
      }
    }
  }

  if (evaluation.status === "degraded" && previous?.status === "degraded") {
    const degradedDuration = now - previous.statusSince;
    reduceProactive = degradedDuration >= HEALTH_DEGRADED_PROACTIVE_MS;
  }

  if (evaluation.status === "critical") {
    reduceProactive = true;
  }

  const nextState: StoredHealthState = {
    status: evaluation.status,
    statusSince: statusChanged ? now : (previous?.statusSince ?? now),
    featureLevel,
    lastAlertAt: previous?.lastAlertAt ?? null,
  };

  await persistHealthState(locationId, nextState);

  return {
    reduceProactive,
    gradualRestore,
    statusChanged,
    previousStatus,
  };
}

export async function markHealthAlertSent(
  locationId: string,
  now = Date.now()
): Promise<void> {
  const previous = await loadStoredHealthState(locationId);
  if (!previous) return;

  await persistHealthState(locationId, {
    ...previous,
    lastAlertAt: now,
  });
}

export function shouldEmitHealthAlert(
  state: StoredHealthState | null,
  evaluation: DenisHealthEvaluation,
  now = Date.now(),
  cooldownMs = 15 * 60_000
): boolean {
  if (evaluation.status === "healthy") return false;
  if (!state?.lastAlertAt) return true;
  return now - state.lastAlertAt >= cooldownMs;
}
