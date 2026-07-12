/**
 * Read/persist side of the prompt-evolution flywheel's status — split out
 * of eval/prompt-evolution-store.ts (2026-07-12) to fix a real layering
 * violation: the "cognition" layer (perceive-guest-chat-turn.ts) is not
 * allowed to import "eval" (src/lib/denis/layers.ts's DENIS_IMPORT_MATRIX
 * — eval may depend on cognition, never the reverse). This file lives
 * under knowledge/, the same undeclared, layer-system-exempt folder
 * restaurant-knowledge-store.ts already uses for the identical shape of
 * problem: a durable, read-at-prompt-time knowledge block.
 *
 * The write/accumulation side that actually needs eval-specific types
 * (ExtractedLearning, PromptAbEvalResult) stays in eval/prompt-evolution-store.ts.
 */
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const LEARNINGS_TTL_SEC = 60 * 24 * 3_600;

function statusKey(locationId: string): string {
  return `denis:eval:prompt-evolution:${locationId}`;
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

/**
 * Evolved section for this location's live prompt — null unless it's
 * actually cleared the confidence bar, never a half-confident guess. Feeds
 * buildSystemPrompt (via evolvedLearningsBlock in perceive-guest-chat-turn.ts)
 * on every real guest turn.
 */
export async function loadEvolvedLearningsBlock(
  locationId: string
): Promise<string | null> {
  const status = await loadPromptEvolutionStatus(locationId);
  if (!status?.eligibleForFounderReview || !status.evolvedSection?.trim()) {
    return null;
  }
  return status.evolvedSection.trim();
}
