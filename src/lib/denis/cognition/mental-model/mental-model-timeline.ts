import type { InterventionDecision } from "@/lib/denis/cognition/intervention/intervention-types";
import type { GmmGateReason } from "@/lib/denis/cognition/proactive/proactive-policy-types";
import type { ProactivePolicyEvaluation } from "@/lib/denis/cognition/proactive/proactive-policy-types";
import type { OfferTimingKind } from "@/lib/denis/cognition/offer/offer-types";
import type {
  GuestIntentTransition,
  GuestMentalModel,
  PreviousMentalFoldContext,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { MentalModelDiff } from "@/lib/denis/cognition/mental-model/diff-mental-model";
import { diffMentalModel } from "@/lib/denis/cognition/mental-model/diff-mental-model";
import type { MentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type GuestMentalModelSnapshot = {
  hash: string;
  intent: GuestMentalModel["intent"];
  pace: GuestMentalModel["pace"];
  receptiveness: GuestMentalModel["receptiveness"];
  mealStage: GuestMentalModel["mealStage"];
  predictedNeed: GuestMentalModel["predictedNeed"];
  frustrationLevel: GuestMentalModel["affect"]["frustration"]["level"];
  groupMode: GuestMentalModel["groupDynamics"]["mode"];
  addressLeader: GuestMentalModel["groupDynamics"]["addressLeader"];
  intentTransitions: GuestIntentTransition[];
  decline: Pick<GuestMentalModel["decline"], "hardClosed" | "dismissedCount">;
  nudgeBudget: Pick<GuestMentalModel["nudgeBudget"], "remaining" | "max">;
};

export type MentalModelUpdatedPayload = {
  type: "mental_model.updated";
  hash: string;
  computedAt: number;
  confidence: number;
  model: GuestMentalModelSnapshot;
  triggers: string[];
};

export type MentalModelDiffPayload = {
  type: "mental_model.diff";
  hash: string;
  significant: boolean;
  changes: MentalModelDiff["changes"];
  intentTransition: GuestIntentTransition | null;
  triggers: string[];
};

export type MentalModelGateEvaluation = {
  kind: string;
  allow: boolean;
  reason: GmmGateReason | null;
};

export type MentalModelGateIjsBlock = {
  manifestVersion: string;
  decision: InterventionDecision;
  ijsDecision: InterventionDecision;
  ruleId: string | null;
  shouldBlockSpeak: boolean;
  enforced: boolean;
};

export type MentalModelGateRhythmBlock = {
  mode: "off" | "shadow" | "enforce";
  slotKey: string | null;
  confidence: number;
  applied: boolean;
  defaultDessertDelayMin: number;
  wouldOverrideDessertDelayMin: number | null;
  servicePeriod: string | null;
};

export type MentalModelGatePayload = {
  type: "mental_model.gate";
  mode: MentalModelMode;
  candidateKind: GuestProactiveNudgeKind;
  allow: boolean;
  enforced: boolean;
  reason: GmmGateReason | null;
  wouldBlock: boolean;
  mentalHash: string;
  evaluationChain?: MentalModelGateEvaluation[];
  timingKind?: OfferTimingKind | null;
  topRankedKind?: GuestProactiveNudgeKind | null;
  selectedKind?: GuestProactiveNudgeKind | null;
  source?: "session.watcher" | "sense.proactive_brain" | "scheduler.wakeup";
  policyVersion?: string;
  /** ADR-041 P3 — IJS audit block on proactive gate rows. */
  ijs?: MentalModelGateIjsBlock;
  /** ADR-042 VRP-P0 — rhythm prior audit (shadow/enforce). */
  rhythm?: MentalModelGateRhythmBlock;
};

export function summarizeMentalModelForTimeline(
  mental: GuestMentalModel
): GuestMentalModelSnapshot {
  return {
    hash: mental.hash,
    intent: mental.intent,
    pace: mental.pace,
    receptiveness: mental.receptiveness,
    mealStage: mental.mealStage,
    predictedNeed: mental.predictedNeed,
    frustrationLevel: mental.affect.frustration.level,
    groupMode: mental.groupDynamics.mode,
    addressLeader: mental.groupDynamics.addressLeader,
    intentTransitions: mental.intentTransitions,
    decline: {
      hardClosed: mental.decline.hardClosed,
      dismissedCount: mental.decline.dismissedCount,
    },
    nudgeBudget: {
      remaining: mental.nudgeBudget.remaining,
      max: mental.nudgeBudget.max,
    },
  };
}

export function extractLastMentalModelSnapshot(
  timeline: DenisTimelineRow[]
): GuestMentalModelSnapshot | null {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const row = timeline[i]!;
    if (row.event_type !== "mental_model.updated") continue;
    const payload = row.payload;
    if (!payload || typeof payload !== "object") continue;
    const model = (payload as { model?: GuestMentalModelSnapshot }).model;
    if (!model || typeof model.hash !== "string") continue;
    return model;
  }
  return null;
}

export function extractLastMentalModelHash(timeline: DenisTimelineRow[]): string | null {
  return extractLastMentalModelSnapshot(timeline)?.hash ?? null;
}

export function extractPreviousMentalFoldContext(
  timeline: DenisTimelineRow[]
): PreviousMentalFoldContext | null {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const row = timeline[i]!;
    if (row.event_type !== "mental_model.updated") continue;
    const payload = row.payload;
    if (!payload || typeof payload !== "object") continue;

    const typed = payload as Partial<MentalModelUpdatedPayload> & {
      model?: GuestMentalModelSnapshot;
    };
    const model = typed.model;
    if (!model || typeof model.intent !== "string") continue;

    const computedAt =
      typeof typed.computedAt === "number"
        ? typed.computedAt
        : new Date(row.created_at).getTime();

    return {
      intent: model.intent,
      computedAt,
      intentTransitions: model.intentTransitions ?? [],
    };
  }
  return null;
}

export function deriveMentalModelTriggers(
  previous: GuestMentalModelSnapshot | null,
  current: GuestMentalModel
): string[] {
  if (!previous) {
    const triggers = ["initial"];
    if (current.decline.hardClosed) triggers.push("decline:hardClosed");
    return triggers;
  }

  const triggers: string[] = [];
  const snapshot = summarizeMentalModelForTimeline(current);

  if (previous.intent !== snapshot.intent) {
    triggers.push(`intent:${previous.intent}→${snapshot.intent}`);
  }
  if (previous.receptiveness !== snapshot.receptiveness) {
    triggers.push(`receptiveness:${previous.receptiveness}→${snapshot.receptiveness}`);
  }
  if (!previous.decline.hardClosed && snapshot.decline.hardClosed) {
    triggers.push("decline:hardClosed");
  }
  if (previous.nudgeBudget.remaining > 0 && snapshot.nudgeBudget.remaining === 0) {
    triggers.push("nudgeBudget:zero");
  }
  if (previous.predictedNeed !== snapshot.predictedNeed) {
    triggers.push(`predictedNeed:${previous.predictedNeed}→${snapshot.predictedNeed}`);
  }
  if (previous.mealStage !== snapshot.mealStage) {
    triggers.push(`mealStage:${previous.mealStage}→${snapshot.mealStage}`);
  }
  if (
    previous.frustrationLevel !== snapshot.frustrationLevel &&
    snapshot.frustrationLevel === "high"
  ) {
    triggers.push(`frustration:${snapshot.frustrationLevel}`);
  }
  if (
    previous.groupMode !== snapshot.groupMode ||
    previous.addressLeader !== snapshot.addressLeader
  ) {
    triggers.push(
      `group:${snapshot.groupMode}:${snapshot.addressLeader ? "leader" : "follower"}`
    );
  }

  return triggers.length > 0 ? triggers : ["refold"];
}

export function buildMentalModelUpdatedPayload(input: {
  mental: GuestMentalModel;
  previous: GuestMentalModelSnapshot | null;
}): MentalModelUpdatedPayload {
  return {
    type: "mental_model.updated",
    hash: input.mental.hash,
    computedAt: input.mental.computedAt,
    confidence: input.mental.confidence,
    model: summarizeMentalModelForTimeline(input.mental),
    triggers: deriveMentalModelTriggers(input.previous, input.mental),
  };
}

export function buildMentalModelDiffPayload(input: {
  mental: GuestMentalModel;
  previous: GuestMentalModelSnapshot | null;
}): MentalModelDiffPayload {
  const diff = diffMentalModel({
    previous: input.previous,
    current: input.mental,
  });

  return {
    type: "mental_model.diff",
    hash: input.mental.hash,
    significant: diff.significant,
    changes: diff.changes,
    intentTransition: diff.intentTransition,
    triggers: deriveMentalModelTriggers(input.previous, input.mental),
  };
}

export function shouldAppendMentalModelDiff(input: {
  previous: GuestMentalModelSnapshot | null;
  mental: GuestMentalModel;
}): boolean {
  return diffMentalModel({
    previous: input.previous,
    current: input.mental,
  }).significant;
}

export function shouldAppendMentalModelUpdated(input: {
  timeline: DenisTimelineRow[];
  mental: GuestMentalModel;
}): boolean {
  const previousHash = extractLastMentalModelHash(input.timeline);
  return previousHash !== input.mental.hash;
}

export function buildMentalModelGatePayload(input: {
  mental: GuestMentalModel;
  mode: MentalModelMode;
  candidateKind: GuestProactiveNudgeKind;
  allow: boolean;
  enforced: boolean;
  reason: GmmGateReason | null;
  wouldBlock: boolean;
  evaluationChain?: ProactivePolicyEvaluation[];
  timingKind?: OfferTimingKind | null;
  topRankedKind?: GuestProactiveNudgeKind | null;
  selectedKind?: GuestProactiveNudgeKind | null;
  source?: "session.watcher" | "sense.proactive_brain" | "scheduler.wakeup";
  policyVersion?: string;
  ijs?: MentalModelGateIjsBlock;
  rhythm?: MentalModelGateRhythmBlock;
}): MentalModelGatePayload {
  return {
    type: "mental_model.gate",
    mode: input.mode,
    candidateKind: input.candidateKind,
    allow: input.allow,
    enforced: input.enforced,
    reason: input.reason,
    wouldBlock: input.wouldBlock,
    mentalHash: input.mental.hash,
    evaluationChain: input.evaluationChain?.map((row) => ({
      kind: row.kind,
      allow: row.allow,
      reason: row.reason,
    })),
    timingKind: input.timingKind ?? null,
    topRankedKind: input.topRankedKind ?? null,
    selectedKind: input.selectedKind ?? null,
    source: input.source,
    policyVersion: input.policyVersion,
    ijs: input.ijs,
    rhythm: input.rhythm,
  };
}
