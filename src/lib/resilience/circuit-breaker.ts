import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis/client";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type CircuitBreakerConfig = {
  failureThreshold: number;
  resetTimeoutMs: number;
};

type StoredCircuitState = {
  failures: number;
  openUntil: number;
};

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
};

const SERVICE_CONFIG: Record<string, Partial<CircuitBreakerConfig>> = {
  openai: { failureThreshold: 3, resetTimeoutMs: 30_000 },
  fiskaly: { failureThreshold: 3, resetTimeoutMs: 30_000 },
  stripe: { failureThreshold: 3, resetTimeoutMs: 30_000 },
};

const memoryStore = new Map<string, StoredCircuitState>();

export class CircuitOpenError extends Error {
  readonly serviceName: string;

  constructor(serviceName: string) {
    super(`Circuit open for ${serviceName}`);
    this.name = "CircuitOpenError";
    this.serviceName = serviceName;
  }
}

function configFor(serviceName: string): CircuitBreakerConfig {
  const overrides = SERVICE_CONFIG[serviceName] ?? {};
  return {
    failureThreshold:
      overrides.failureThreshold ?? DEFAULT_CONFIG.failureThreshold,
    resetTimeoutMs: overrides.resetTimeoutMs ?? DEFAULT_CONFIG.resetTimeoutMs,
  };
}

function redisKey(serviceName: string) {
  return `cb:${serviceName}`;
}

function emptyState(): StoredCircuitState {
  return { failures: 0, openUntil: 0 };
}

async function loadState(serviceName: string): Promise<StoredCircuitState> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const stored = await redis.get<StoredCircuitState>(redisKey(serviceName));
      if (stored) return stored;
    } catch (error) {
      logger.warn("Circuit breaker Redis read failed", {
        serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return memoryStore.get(serviceName) ?? emptyState();
}

async function saveState(
  serviceName: string,
  state: StoredCircuitState
): Promise<void> {
  memoryStore.set(serviceName, state);

  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(redisKey(serviceName), state, {
      ex: Math.ceil(
        (configFor(serviceName).resetTimeoutMs * 4) / 1000
      ),
    });
  } catch (error) {
    logger.warn("Circuit breaker Redis write failed", {
      serviceName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function resolveCircuitState(
  stored: StoredCircuitState,
  now = Date.now()
): CircuitState {
  if (stored.openUntil > now) return "OPEN";
  if (stored.openUntil > 0) return "HALF_OPEN";
  return "CLOSED";
}

export type CircuitLabel = "closed" | "open" | "half_open";

export function circuitStateLabel(state: CircuitState): CircuitLabel {
  switch (state) {
    case "CLOSED":
      return "closed";
    case "OPEN":
      return "open";
    case "HALF_OPEN":
      return "half_open";
  }
}

export async function getCircuitBreakerStatus(serviceName: string): Promise<{
  circuit: CircuitLabel;
  ok: boolean;
}> {
  const stored = await loadState(serviceName);
  const state = resolveCircuitState(stored);
  return {
    circuit: circuitStateLabel(state),
    ok: state !== "OPEN",
  };
}

async function recordSuccess(serviceName: string): Promise<void> {
  await saveState(serviceName, emptyState());
}

async function recordFailure(serviceName: string): Promise<void> {
  const config = configFor(serviceName);
  const stored = await loadState(serviceName);
  const now = Date.now();
  const current = resolveCircuitState(stored, now);
  const wasHalfOpen = current === "HALF_OPEN";

  const failures = wasHalfOpen ? config.failureThreshold : stored.failures + 1;
  const shouldOpen = failures >= config.failureThreshold;

  await saveState(serviceName, {
    failures: shouldOpen ? config.failureThreshold : failures,
    openUntil: shouldOpen ? now + config.resetTimeoutMs : stored.openUntil,
  });

  if (shouldOpen) {
    logger.warn("Circuit breaker opened", {
      serviceName,
      failures,
      resetTimeoutMs: config.resetTimeoutMs,
    });
  }
}

export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  fallback?: () => T | Promise<T>
): Promise<T> {
  const stored = await loadState(serviceName);
  const state = resolveCircuitState(stored);

  if (state === "OPEN") {
    if (fallback) {
      return fallback();
    }
    throw new CircuitOpenError(serviceName);
  }

  try {
    const result = await fn();
    await recordSuccess(serviceName);
    return result;
  } catch (error) {
    await recordFailure(serviceName);
    throw error;
  }
}

export type FiskalyDeferredSigningResult = {
  signed: false;
  queued: true;
};

export function isFiskalyDeferredSigningResult(
  value: unknown
): value is FiskalyDeferredSigningResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "signed" in value &&
    (value as FiskalyDeferredSigningResult).signed === false &&
    "queued" in value &&
    (value as FiskalyDeferredSigningResult).queued === true
  );
}

export class TseSigningDeferredError extends Error {
  constructor(public readonly orderId: string) {
    super("TSE signing deferred — fiskaly circuit open");
    this.name = "TseSigningDeferredError";
  }
}

export function logFiskalyCircuitDeferred(orderId: string) {
  logger.warn("fiskaly circuit open, TSE signing deferred", { orderId });
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage("fiskaly circuit open, TSE signing deferred", {
      level: "warning",
      extra: { orderId },
    });
  }
}

/** Test helper — clears in-memory circuit state for a service. */
export function resetCircuitBreakerForTests(serviceName?: string) {
  if (serviceName) {
    memoryStore.delete(serviceName);
    return;
  }
  memoryStore.clear();
}
