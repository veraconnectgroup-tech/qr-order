/**
 * Redis-backed accumulator for the prompt-evolution flywheel
 * (prompt-evolver.ts). Learnings are computed per-session but the A/B
 * evolution decision needs learnings pooled across many sessions per
 * location (PROMPT_LEARNING_THRESHOLD) — this is that pool.
 *
 * The read/persist side of the flywheel's *status* (including
 * loadEvolvedLearningsBlock, which feeds buildSystemPrompt on every real
 * guest turn) lives in @/lib/denis/knowledge/evolved-learnings-store.ts —
 * split out (2026-07-12) because the "cognition" layer that reads it
 * (perceive-guest-chat-turn.ts) is not allowed to import "eval"
 * (src/lib/denis/layers.ts's DENIS_IMPORT_MATRIX). This file keeps only
 * the accumulation side, which needs eval-specific types
 * (ExtractedLearning, PromptAbEvalResult) and stays eval-only.
 */
import type { ExtractedLearning } from "@/lib/denis/eval/learning-extractor";
import type { PromptAbEvalResult } from "@/lib/denis/eval/prompt-evolver";
import type { PromptEvolutionStatus } from "@/lib/denis/knowledge/evolved-learnings-store";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const LEARNINGS_TTL_SEC = 60 * 24 * 3_600;
const MAX_ACCUMULATED_LEARNINGS = 300;

function learningsKey(locationId: string): string {
  return `denis:eval:prompt-learnings:${locationId}`;
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
