import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";
import { claimSignalId } from "@/lib/denis/actor/signal-dedupe";
import {
  actorLockKey,
  actorQueueKey,
  actorResultKey,
} from "@/lib/denis/actor/redis-keys";
import type {
  QueuedTableSessionSignal,
  StoredSignalHttpResult,
} from "@/lib/denis/actor/types";
import { logger } from "@/lib/logger";

const LOCK_TTL_SEC = 45;
const RESULT_TTL_SEC = 120;
const HTTP_WAIT_MS = 55_000;
/** Template/gap turns must complete within pilot SLA (AGENT-02). */
export const GUEST_SIGNAL_TEMPLATE_WAIT_MS = 15_000;
const POLL_MS = 100;
const DRAIN_LOCK_RETRY_MS = 200;
/** ~15s lock wait — matches template pilot SLA when another drain holds the lock. */
const DRAIN_LOCK_MAX_ATTEMPTS = 75;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Phase E — Redis infra available for actor queue + lock. */
export function isTableSessionActorInfrastructureReady(): boolean {
  return getAiRedis() != null;
}

async function storeSignalResult(
  signalId: string,
  result: StoredSignalHttpResult
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.set(actorResultKey(signalId), JSON.stringify(result), {
      ex: RESULT_TTL_SEC,
    });
  } catch (error) {
    logRedisDegradation(`actor:result:write:${signalId}`, error);
  }
}

async function readSignalResult(
  signalId: string
): Promise<StoredSignalHttpResult | null> {
  const redis = getAiRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(actorResultKey(signalId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredSignalHttpResult;
  } catch (error) {
    logRedisDegradation(`actor:result:read:${signalId}`, error);
    return null;
  }
}

async function responseToStoredResult(
  response: Response
): Promise<StoredSignalHttpResult> {
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function processQueuedSignal(item: QueuedTableSessionSignal): Promise<void> {
  const isNew = await claimSignalId(item.signalId);
  if (!isNew) {
    return;
  }

  try {
    if (item.kind === "world" && item.worldPayload) {
      const { runDenisWorldSignal } = await import(
        "@/lib/denis/runtime/run-denis-world-signal"
      );
      await runDenisWorldSignal(item.worldPayload as Record<string, unknown>);
      return;
    }

    if (item.kind === "experience" && item.experiencePayload) {
      const { runCommerceExperience } = await import(
        "@/lib/commerce/runtime/run-commerce-experience"
      );
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const payload = item.experiencePayload;
      await runCommerceExperience(
        admin,
        { kind: payload.triggerKind, orderId: payload.orderId },
        {
          traceId: payload.traceId,
          idempotencyKey: payload.idempotencyKey,
          skipActorEnqueue: true,
        }
      );
      return;
    }

    if (item.kind === "guest" && item.rawBody != null) {
      const { executeDenisSignalCore } = await import(
        "@/lib/denis/runtime/execute-denis-signal-core"
      );
      const response = await executeDenisSignalCore(item.rawBody);
      await storeSignalResult(item.signalId, await responseToStoredResult(response));
    }
  } catch (error) {
    logger.warn("TableSessionActor signal failed", {
      signalId: item.signalId,
      kind: item.kind,
      error: error instanceof Error ? error.message : String(error),
    });
    await storeSignalResult(item.signalId, {
      status: 500,
      body: { error: "signal_processing_failed" },
    });
  }
}

async function drainQueue(
  tableSessionId: string,
  lockAttempt = 0
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  const lockToken = crypto.randomUUID();
  const lockKey = actorLockKey(tableSessionId);

  try {
    const acquired = await redis.set(lockKey, lockToken, {
      nx: true,
      ex: LOCK_TTL_SEC,
    });
    if (acquired !== "OK") {
      if (lockAttempt < DRAIN_LOCK_MAX_ATTEMPTS) {
        await sleep(DRAIN_LOCK_RETRY_MS);
        return drainQueue(tableSessionId, lockAttempt + 1);
      }
      return;
    }

    const queueKey = actorQueueKey(tableSessionId);

    while (true) {
      const raw = await redis.lpop<string>(queueKey);
      if (!raw) break;

      let item: QueuedTableSessionSignal;
      try {
        item =
          typeof raw === "string"
            ? (JSON.parse(raw) as QueuedTableSessionSignal)
            : (raw as QueuedTableSessionSignal);
      } catch {
        logger.warn("TableSessionActor invalid queue item", { tableSessionId });
        continue;
      }

      await processQueuedSignal(item);
    }
  } catch (error) {
    logRedisDegradation(`actor:drain:${tableSessionId}`, error);
  } finally {
    try {
      const current = await redis.get<string>(lockKey);
      if (current === lockToken) {
        await redis.del(lockKey);
      }
    } catch (error) {
      logRedisDegradation(`actor:unlock:${tableSessionId}`, error);
    }
  }
}

async function enqueueSignal(
  tableSessionId: string,
  item: QueuedTableSessionSignal
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) {
    throw new Error("actor_unavailable");
  }

  try {
    await redis.rpush(actorQueueKey(tableSessionId), JSON.stringify(item));
    await drainQueue(tableSessionId);
  } catch (error) {
    logRedisDegradation(`actor:enqueue:${tableSessionId}`, error);
    throw error;
  }
}

export async function waitForSignalResult(
  signalId: string,
  timeoutMs = HTTP_WAIT_MS
): Promise<StoredSignalHttpResult | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const cached = await readSignalResult(signalId);
    if (cached) return cached;
    await sleep(POLL_MS);
  }

  return null;
}

export function resolveGuestSignalWaitMs(rawBody: unknown): number {
  if (!rawBody || typeof rawBody !== "object") return HTTP_WAIT_MS;
  const text =
    typeof (rawBody as { text?: string }).text === "string"
      ? (rawBody as { text: string }).text.trim().toLowerCase()
      : "";
  // Template gap / confirm paths — pilot SLA <15s (AGENT-02).
  if (
    text === "da" ||
    text.includes("pivo") ||
    text.includes("pilsner") ||
    text.includes("burger")
  ) {
    return GUEST_SIGNAL_TEMPLATE_WAIT_MS;
  }
  return HTTP_WAIT_MS;
}

export async function enqueueGuestSignalAndWait(
  tableSessionId: string,
  signalId: string,
  rawBody: unknown
): Promise<StoredSignalHttpResult | null> {
  const existing = await readSignalResult(signalId);
  if (existing) return existing;

  await enqueueSignal(tableSessionId, {
    signalId,
    kind: "guest",
    enqueuedAt: new Date().toISOString(),
    rawBody,
  });

  return waitForSignalResult(signalId, resolveGuestSignalWaitMs(rawBody));
}

export async function enqueueWorldSignal(
  tableSessionId: string,
  signalId: string,
  worldPayload: QueuedTableSessionSignal["worldPayload"]
): Promise<void> {
  await enqueueSignal(tableSessionId, {
    signalId,
    kind: "world",
    enqueuedAt: new Date().toISOString(),
    worldPayload,
  });
}

/** ADR-013/020 §17 — commerce triggers enter Denis actor queue as signals. */
export async function enqueueCommerceExperienceSignal(
  tableSessionId: string,
  signalId: string,
  experiencePayload: NonNullable<QueuedTableSessionSignal["experiencePayload"]>
): Promise<void> {
  await enqueueSignal(tableSessionId, {
    signalId,
    kind: "experience",
    enqueuedAt: new Date().toISOString(),
    experiencePayload,
  });
}

/** Build HTTP Response from actor-stored result. */
export function signalResultToResponse(
  result: StoredSignalHttpResult | null
): Response {
  if (!result) {
    return new Response(JSON.stringify({ error: "signal_timeout" }), {
      status: 504,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}
