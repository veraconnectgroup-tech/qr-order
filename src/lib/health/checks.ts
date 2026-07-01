import { getCircuitBreakerStatus } from "@/lib/resilience/circuit-breaker";
import { getRedisClient } from "@/lib/redis/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HealthSummary } from "@/lib/degradation/status";

const DB_TIMEOUT_MS = 3000;

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type HealthChecks = {
  database: { status: "up" | "down"; latency_ms: number };
  redis: { status: "up" | "down" | "unconfigured"; latency_ms?: number };
  stripe: { status: "configured" | "unconfigured" };
};

export type WriteCheck = {
  status: "up" | "down";
  latency_ms: number;
};

export type HealthPayload = {
  status: HealthStatus;
  version: string;
  timestamp: string;
  checks: HealthChecks;
  uptime_seconds: number;
  write_test?: WriteCheck;
};

export type DeepHealthChecks = {
  database: { ok: boolean; latency_ms: number };
  redis: { ok: boolean; latency_ms?: number };
  fiskaly: { ok: boolean; circuit: string };
  stripe: { ok: boolean; circuit: string };
  openai: { ok: boolean; circuit: string };
};

export type DeepHealthPayload = {
  status: HealthStatus;
  checks: DeepHealthChecks;
  timestamp: string;
};

function getRedis() {
  return getRedisClient();
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), ms);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function getHealthVersion(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";
}

export async function checkDatabase(): Promise<HealthChecks["database"]> {
  const start = Date.now();

  try {
    const admin = createAdminClient();
    // health_ping added in migration 00029 — not yet in generated Database types
    const { error } = await withTimeout(
      (admin as { rpc: (fn: string) => PromiseLike<{ error: unknown }> }).rpc(
        "health_ping"
      ),
      DB_TIMEOUT_MS
    );

    if (error) {
      return { status: "down", latency_ms: Date.now() - start };
    }

    return { status: "up", latency_ms: Date.now() - start };
  } catch {
    return { status: "down", latency_ms: Date.now() - start };
  }
}

export async function checkRedis(): Promise<HealthChecks["redis"]> {
  const client = getRedis();
  if (!client) {
    return { status: "unconfigured" };
  }

  const start = Date.now();

  try {
    await withTimeout(client.ping(), DB_TIMEOUT_MS);
    return { status: "up", latency_ms: Date.now() - start };
  } catch {
    return { status: "down", latency_ms: Date.now() - start };
  }
}

async function checkDatabaseDeep(): Promise<DeepHealthChecks["database"]> {
  const result = await checkDatabase();
  return {
    ok: result.status === "up",
    latency_ms: result.latency_ms,
  };
}

async function checkRedisDeep(): Promise<DeepHealthChecks["redis"]> {
  const client = getRedis();
  if (!client) {
    return { ok: false };
  }

  const start = Date.now();

  try {
    await withTimeout(client.ping(), DB_TIMEOUT_MS);
    return { ok: true, latency_ms: Date.now() - start };
  } catch {
    return { ok: false, latency_ms: Date.now() - start };
  }
}

export function resolveDeepHealthStatus(checks: DeepHealthChecks): HealthStatus {
  if (!checks.database.ok || !checks.stripe.ok) {
    return "unhealthy";
  }

  if (!checks.redis.ok || !checks.fiskaly.ok || !checks.openai.ok) {
    return "degraded";
  }

  return "healthy";
}

export async function runDeepHealthChecks(): Promise<DeepHealthPayload> {
  const [database, redis, fiskaly, stripe, openai] = await Promise.all([
    checkDatabaseDeep(),
    checkRedisDeep(),
    getCircuitBreakerStatus("fiskaly"),
    getCircuitBreakerStatus("stripe"),
    getCircuitBreakerStatus("openai"),
  ]);

  const checks: DeepHealthChecks = {
    database,
    redis,
    fiskaly,
    stripe,
    openai,
  };

  return {
    status: resolveDeepHealthStatus(checks),
    checks,
    timestamp: new Date().toISOString(),
  };
}

export function checkStripe(): HealthChecks["stripe"] {
  return {
    status: process.env.STRIPE_SECRET_KEY ? "configured" : "unconfigured",
  };
}

export async function checkDatabaseWrite(): Promise<WriteCheck> {
  const start = Date.now();

  try {
    const admin = createAdminClient();
    const { data, error: insertError } = await withTimeout(
      admin
        .from("health_check" as never)
        .insert({} as never)
        .select("id")
        .single(),
      DB_TIMEOUT_MS
    );

    if (insertError || !data) {
      return { status: "down", latency_ms: Date.now() - start };
    }

    const row = data as { id: string };
    const { error: deleteError } = await admin
      .from("health_check" as never)
      .delete()
      .eq("id", row.id);

    if (deleteError) {
      return { status: "down", latency_ms: Date.now() - start };
    }

    return { status: "up", latency_ms: Date.now() - start };
  } catch {
    return { status: "down", latency_ms: Date.now() - start };
  }
}

export function resolveHealthStatus(
  checks: HealthChecks,
  writeTest?: WriteCheck
): HealthStatus {
  if (checks.database.status === "down") {
    return "unhealthy";
  }

  const hasFailure =
    checks.redis.status === "down" ||
    (writeTest !== undefined && writeTest.status === "down");

  return hasFailure ? "degraded" : "healthy";
}

export async function runHealthChecks(options?: {
  includeWriteTest?: boolean;
}): Promise<HealthPayload & { circuits?: HealthSummary["circuits"] }> {
  const [database, redis, stripeCircuit, fiskalyCircuit, openaiCircuit] =
    await Promise.all([
      checkDatabase(),
      checkRedis(),
      getCircuitBreakerStatus("stripe"),
      getCircuitBreakerStatus("fiskaly"),
      getCircuitBreakerStatus("openai"),
    ]);
  const stripe = checkStripe();

  const checks: HealthChecks = { database, redis, stripe };
  const write_test = options?.includeWriteTest
    ? await checkDatabaseWrite()
    : undefined;

  return {
    status: resolveHealthStatus(checks, write_test),
    version: getHealthVersion(),
    timestamp: new Date().toISOString(),
    checks,
    uptime_seconds: process.uptime(),
    circuits: {
      stripe: stripeCircuit.circuit,
      fiskaly: fiskalyCircuit.circuit,
      openai: openaiCircuit.circuit,
    },
    ...(write_test ? { write_test } : {}),
  };
}

export function healthHttpStatus(status: HealthStatus): number {
  return status === "unhealthy" ? 503 : 200;
}
