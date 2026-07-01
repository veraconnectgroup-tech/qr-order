import {
  aggregateTurnSamples,
  HEALTH_STUCK_SESSION_MS,
  type DenisHealthMetrics,
  type HealthTurnSample,
} from "@/lib/denis/monitoring/denis-health";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const SAMPLE_TTL_SEC = 7_200;
const MAX_SAMPLES = 500;
const PENDING_TTL_SEC = 120;

function samplesKey(locationId: string): string {
  return `denis:health:samples:${locationId}`;
}

function pendingKey(locationId: string): string {
  return `denis:health:pending:${locationId}`;
}

function loopsKey(locationId: string): string {
  return `denis:health:loops:${locationId}`;
}

export async function markSessionTurnPending(
  locationId: string,
  sessionId: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !sessionId) return;

  try {
    await redis.hset(pendingKey(locationId), {
      [sessionId]: Date.now(),
    });
    await redis.expire(pendingKey(locationId), PENDING_TTL_SEC);
  } catch (error) {
    logRedisDegradation("denis.health.pending.set", error);
  }
}

export async function clearSessionTurnPending(
  locationId: string,
  sessionId: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !sessionId) return;

  try {
    await redis.hdel(pendingKey(locationId), sessionId);
  } catch (error) {
    logRedisDegradation("denis.health.pending.clear", error);
  }
}

export async function recordHealthTurnSample(
  locationId: string,
  sample: Omit<HealthTurnSample, "ts"> & { ts?: number }
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const row: HealthTurnSample = {
    ...sample,
    ts: sample.ts ?? Date.now(),
  };

  try {
    const key = samplesKey(locationId);
    await redis.lpush(key, JSON.stringify(row));
    await redis.ltrim(key, 0, MAX_SAMPLES - 1);
    await redis.expire(key, SAMPLE_TTL_SEC);
    await clearSessionTurnPending(locationId, sample.sessionId);
  } catch (error) {
    logRedisDegradation("denis.health.sample.record", error);
  }
}

export async function incrementLoopDetectionCount(
  locationId: string,
  delta = 1
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const key = loopsKey(locationId);
    await redis.incrby(key, delta);
    await redis.expire(key, SAMPLE_TTL_SEC);
  } catch (error) {
    logRedisDegradation("denis.health.loops.increment", error);
  }
}

async function readSamples(locationId: string): Promise<HealthTurnSample[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  try {
    const raw = await redis.lrange(samplesKey(locationId), 0, MAX_SAMPLES - 1);
    const samples: HealthTurnSample[] = [];
    for (const row of raw) {
      if (typeof row !== "string") continue;
      try {
        samples.push(JSON.parse(row) as HealthTurnSample);
      } catch {
        // skip corrupt row
      }
    }
    return samples.reverse();
  } catch (error) {
    logRedisDegradation("denis.health.samples.read", error);
    return [];
  }
}

async function readStuckSessions(locationId: string): Promise<string[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  try {
    const pending = await redis.hgetall<Record<string, string>>(
      pendingKey(locationId)
    );
    if (!pending) return [];

    const now = Date.now();
    const stuck: string[] = [];
    for (const [sessionId, startedRaw] of Object.entries(pending)) {
      const started = Number(startedRaw);
      if (Number.isFinite(started) && now - started > HEALTH_STUCK_SESSION_MS) {
        stuck.push(sessionId);
      }
    }
    return stuck;
  } catch (error) {
    logRedisDegradation("denis.health.pending.read", error);
    return [];
  }
}

async function readLoopCount(locationId: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  try {
    const count = await redis.get<number>(loopsKey(locationId));
    return typeof count === "number" ? count : Number(count) || 0;
  } catch (error) {
    logRedisDegradation("denis.health.loops.read", error);
    return 0;
  }
}

/** Aggregate live metrics for a location (Redis-backed, lightweight). */
export async function loadDenisHealthMetrics(input: {
  locationId: string;
  activeSessionCount?: number;
}): Promise<DenisHealthMetrics> {
  const [samples, stuckSessions, loopDetectionCount] = await Promise.all([
    readSamples(input.locationId),
    readStuckSessions(input.locationId),
    readLoopCount(input.locationId),
  ]);

  const aggregated = aggregateTurnSamples(samples);
  const errorSamples = samples.filter((s) => s.llmError).length;
  const uptimePercent =
    samples.length === 0
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            100 - (errorSamples / Math.max(samples.length, 1)) * 100
          )
        );

  const activeSessions = new Set(
    samples.slice(-50).map((s) => s.sessionId).filter(Boolean)
  );

  return {
    uptimePercent: Math.round(uptimePercent * 10) / 10,
    avgResponseMs: aggregated.avgResponseMs,
    p95ResponseMs: aggregated.p95ResponseMs,
    refusalRate: aggregated.refusalRate,
    loopDetectionCount,
    t0HitRate: aggregated.t0HitRate,
    llmErrorRate: aggregated.llmErrorRate,
    creditBurnRatePerHour: aggregated.creditBurnRatePerHour,
    activeSessionCount: input.activeSessionCount ?? activeSessions.size,
    stuckSessions,
  };
}
