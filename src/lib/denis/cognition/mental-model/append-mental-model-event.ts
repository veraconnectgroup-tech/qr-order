import {
  buildMentalModelDiffPayload,
  buildMentalModelGatePayload,
  buildMentalModelUpdatedPayload,
  extractLastMentalModelSnapshot,
  shouldAppendMentalModelDiff,
  shouldAppendMentalModelUpdated,
  type MentalModelDiffPayload,
  type MentalModelGatePayload,
  type MentalModelUpdatedPayload,
} from "@/lib/denis/cognition/mental-model/mental-model-timeline";
import type { GmmGateReason } from "@/lib/denis/cognition/mental-model/gate-proactive-nudge";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { MentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function appendMentalModelDiff(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    mental: GuestMentalModel;
    timeline: DenisTimelineRow[];
    contextHash?: string | null;
  }
): Promise<void> {
  const previous = extractLastMentalModelSnapshot(input.timeline);
  const payload: MentalModelDiffPayload = buildMentalModelDiffPayload({
    mental: input.mental,
    previous,
  });

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "mental_model.diff",
    traceId: input.traceId,
    contextHash: input.contextHash ?? input.mental.hash,
    payload,
  });
}

export async function appendMentalModelUpdated(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    mental: GuestMentalModel;
    timeline: DenisTimelineRow[];
    contextHash?: string | null;
  }
): Promise<void> {
  const previous = extractLastMentalModelSnapshot(input.timeline);
  const payload: MentalModelUpdatedPayload = buildMentalModelUpdatedPayload({
    mental: input.mental,
    previous,
  });

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "mental_model.updated",
    traceId: input.traceId,
    contextHash: input.contextHash ?? input.mental.hash,
    payload,
  });
}

export async function appendMentalModelGate(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    mental: GuestMentalModel;
    mode: MentalModelMode;
    candidateKind: GuestProactiveNudgeKind;
    allow: boolean;
    enforced: boolean;
    reason: GmmGateReason | null;
    wouldBlock: boolean;
  }
): Promise<void> {
  const payload: MentalModelGatePayload = buildMentalModelGatePayload(input);

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "mental_model.gate",
    traceId: input.traceId,
    contextHash: input.mental.hash,
    payload,
  });
}

/** Append mental_model.updated when posture hash changed; diff when significant (ADR-038 Val D). */
export async function maybeAppendMentalModelUpdated(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    timeline: DenisTimelineRow[];
    mental: GuestMentalModel;
    contextHash?: string | null;
  }
): Promise<boolean> {
  if (!shouldAppendMentalModelUpdated(input)) return false;

  const previous = extractLastMentalModelSnapshot(input.timeline);
  await appendMentalModelUpdated(admin, input);

  if (
    shouldAppendMentalModelDiff({
      previous,
      mental: input.mental,
    })
  ) {
    await appendMentalModelDiff(admin, input);
  }

  return true;
}
