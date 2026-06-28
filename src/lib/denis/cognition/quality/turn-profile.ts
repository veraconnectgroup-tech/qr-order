import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { computeBeliefsHash } from "@/lib/denis/cognition/beliefs/compute-beliefs-hash";
import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MindTurnProfilePayload = {
  type: "mind.turn_profile";
  tier: string;
  planKind: string;
  planReason: string;
  llmUsed: boolean;
  modelTier?: string;
  model?: string | null;
  complexityScore?: number;
  beliefsHash?: string;
  evidencePointers?: string[];
  pendingSlotActResolved?: boolean;
};

export type BuildTurnProfileInput = {
  turnPlan: TurnPlan;
  llmUsed: boolean;
  tier: string;
  modelTier?: string;
  model?: string | null;
  complexityScore?: number;
  beliefs?: BeliefGraph | null;
  evidencePointers?: string[];
  pendingSlotActResolved?: boolean;
};

export function buildTurnProfile(
  input: BuildTurnProfileInput
): MindTurnProfilePayload {
  return {
    type: "mind.turn_profile",
    tier: input.tier,
    planKind: input.turnPlan.kind,
    planReason: input.turnPlan.reason,
    llmUsed: input.llmUsed,
    modelTier: input.modelTier,
    model: input.model,
    complexityScore: input.complexityScore,
    beliefsHash: input.beliefs ? computeBeliefsHash(input.beliefs) : undefined,
    evidencePointers: input.evidencePointers?.length
      ? input.evidencePointers
      : undefined,
    pendingSlotActResolved: input.pendingSlotActResolved || undefined,
  };
}

/** ADR-031 C4 / MR-7 — append turn profile to Denis timeline. */
export async function appendMindTurnProfile(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    profile: MindTurnProfilePayload;
    truthHash?: string | null;
  }
): Promise<void> {
  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "mind.turn_profile",
    traceId: input.traceId,
    contextHash: input.truthHash ?? input.profile.beliefsHash ?? null,
    payload: input.profile,
  });
}

/** Aggregate LLM invocation rate from timeline turn profiles (live sessions). */
export function aggregateLlmInvocationRate(
  events: Array<{ event_type: string; payload: unknown }>
): { turnCount: number; llmTurnCount: number; rate: number } {
  const profiles = events.filter((row) => row.event_type === "mind.turn_profile");
  const turnCount = profiles.length;
  if (!turnCount) {
    return { turnCount: 0, llmTurnCount: 0, rate: 0 };
  }

  let llmTurnCount = 0;
  for (const row of profiles) {
    const payload = row.payload as MindTurnProfilePayload | null;
    if (payload?.llmUsed === true) llmTurnCount += 1;
  }

  return {
    turnCount,
    llmTurnCount,
    rate: llmTurnCount / turnCount,
  };
}
