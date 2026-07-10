/**
 * Redis-backed accumulator + status store for the prompt-evolution flywheel
 * (prompt-evolver.ts). Learnings are computed per-session but the A/B
 * evolution decision needs learnings pooled across many sessions per
 * location (PROMPT_LEARNING_THRESHOLD) — this is that pool.
 *
 * loadEvolvedLearningsBlock feeds buildSystemPrompt (via
 * evolvedLearningsBlock in perceive-guest-chat-turn.ts) on every real guest
 * turn — no longer shadow-only. Still gated by the same statistical bar
 * this module already computed (winner === "B" at >= 95% confidence,
 * eligibleForFounderReview): a fresh location with no accumulated
 * learnings, or one that hasn't cleared that bar yet, gets nothing added,
 * so this can't affect a venue before it has real evidence behind it.
 */
import type { ExtractedLearning } from "@/lib/denis/eval/learning-extractor";
import type { PromptAbEvalResult } from "@/lib/denis/eval/prompt-evolver";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const LEARNINGS_TTL_SEC = 60 * 24 * 3_600;
const MAX_ACCUMULATED_LEARNINGS = 300;

function learningsKey(locationId: string): string {
  return `denis:eval:prompt-learnings:${locationId}`;
}

function statusKey(locationId: string): string {
  return `denis:eval:prompt-evolution:${locationId}`;
}

export async function loadAccumulatedLearnings(
  locationId: string
): Promise<ExtractedLearning[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  try {
    const rows = await redis.lrange<ExtractedLearning>(
      learningsKey(locationId),
      0,
      -1
    );
    return rows ?? [];
  } catch (error) {
    logRedisDegradation("denis.eval.prompt_learnings.read", error);
    return [];
  }
}

/** Append this session's learnings to the location's pool, capped to the most recent N. */
export async function appendAccumulatedLearnings(
  locationId: string,
  learnings: ExtractedLearning[]
): Promise<void> {
  if (learnings.length === 0) return;
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const key = learningsKey(locationId);
    for (const learning of learnings) {
      await redis.rpush(key, learning);
    }
    await redis.ltrim(key, -MAX_ACCUMULATED_LEARNINGS, -1);
    await redis.expire(key, LEARNINGS_TTL_SEC);
  } catch (error) {
    logRedisDegradation("denis.eval.prompt_learnings.append", error);
  }
}

export type PromptEvolutionStatus = {
  locationId: string;
  ready: boolean;
  learningCount: number;
  winner: "A" | "B" | "inconclusive" | null;
  confidence: number | null;
  lift: number | null;
  recommendation: string | null;
  evolvedSection: string | null;
  /** Mirrors canAutoDeployPromptEvolution's own gate — always false here, shadow only. */
  eligibleForFounderReview: boolean;
  updatedAt: string;
};

export async function persistPromptEvolutionStatus(
  status: PromptEvolutionStatus
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(statusKey(status.locationId), status, {
      ex: LEARNINGS_TTL_SEC,
    });
  } catch (error) {
    logRedisDegradation("denis.eval.prompt_evolution.persist", error);
  }
}

export async function loadPromptEvolutionStatus(
  locationId: string
): Promise<PromptEvolutionStatus | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get<PromptEvolutionStatus>(statusKey(locationId));
  } catch (error) {
    logRedisDegradation("denis.eval.prompt_evolution.read", error);
    return null;
  }
}

/** Evolved section for this location's live prompt — null unless it's actually cleared the confidence bar, never a half-confident guess. */
export async function loadEvolvedLearningsBlock(
  locationId: string
): Promise<string | null> {
  const status = await loadPromptEvolutionStatus(locationId);
  if (!status?.eligibleForFounderReview || !status.evolvedSection?.trim()) {
    return null;
  }
  return status.evolvedSection.trim();
}

export function statusFromAbResult(input: {
  locationId: string;
  learningCount: number;
  abResult: PromptAbEvalResult | null;
  evolvedSection: string | null;
}): PromptEvolutionStatus {
  return {
    locationId: input.locationId,
    ready: input.abResult !== null,
    learningCount: input.learningCount,
    winner: input.abResult?.winner ?? null,
    confidence: input.abResult?.confidence ?? null,
    lift: input.abResult?.lift ?? null,
    recommendation: input.abResult?.recommendation ?? null,
    evolvedSection: input.evolvedSection,
    eligibleForFounderReview:
      input.abResult?.winner === "B" && (input.abResult?.confidence ?? 0) >= 0.95,
    updatedAt: new Date().toISOString(),
  };
}
