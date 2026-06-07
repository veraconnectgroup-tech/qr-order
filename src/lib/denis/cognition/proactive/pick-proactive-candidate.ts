import { applyProactivePolicy, evaluateProactivePolicyForKind } from "@/lib/denis/cognition/proactive/apply-proactive-policy";
import { enrichProactiveCandidates } from "@/lib/denis/cognition/proactive/enrich-proactive-candidate";
import type {
  ProactivePolicyEvaluation,
  ProactivePolicyReason,
} from "@/lib/denis/cognition/proactive/proactive-policy-types";
import {
  rankProactiveCandidates,
  type RankProactiveCandidatesInput,
} from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  resolveMentalModelMode,
  type MentalModelMode,
} from "@/lib/denis/config/resolve-mental-model-mode";

export type ProactivePolicyTrace = {
  mode: MentalModelMode;
  candidateKind: GuestProactiveNudge["kind"];
  allow: boolean;
  reason: ProactivePolicyReason | null;
  wouldBlock: boolean;
  enforced: boolean;
};

export type PickProactiveCandidateResult = {
  candidate: GuestProactiveNudge | null;
  rankedCount: number;
  policyTrace: ProactivePolicyTrace | null;
  evaluationChain: ProactivePolicyEvaluation[];
  topRankedKind: GuestProactiveNudge["kind"] | null;
  selectedKind: GuestProactiveNudge["kind"] | null;
};

function emptyPickMeta(): Pick<
  PickProactiveCandidateResult,
  "evaluationChain" | "topRankedKind" | "selectedKind"
> {
  return {
    evaluationChain: [],
    topRankedKind: null,
    selectedKind: null,
  };
}

/** Rank → enrich(offer) → policy manifest → first allowed (ADR-038 GMM-6/10). */
export function pickProactiveCandidate(
  input: RankProactiveCandidatesInput & {
    offer?: GuestOfferContext | null;
    language?: string | null;
  }
): PickProactiveCandidateResult {
  const ranked = enrichProactiveCandidates({
    ranked: rankProactiveCandidates(input),
    offer: input.offer,
    language: input.language,
    config: input.config as ConciergeConfig,
  });
  const config = input.config as ConciergeConfig;
  const mode = resolveMentalModelMode(config);
  const confidenceFallback = config.mentalModel.confidenceFallbackThreshold;
  const topRankedKind = ranked[0]?.nudge.kind ?? null;

  if (ranked.length === 0) {
    return { candidate: null, rankedCount: 0, policyTrace: null, ...emptyPickMeta() };
  }

  const lowConfidence =
    input.mental != null &&
    mode !== "off" &&
    input.mental.confidence < confidenceFallback;

  if (mode === "off" || !input.mental) {
    return {
      candidate: ranked[0]!.nudge,
      rankedCount: ranked.length,
      policyTrace: null,
      evaluationChain: [],
      topRankedKind,
      selectedKind: ranked[0]!.nudge.kind,
    };
  }

  if (lowConfidence && mode === "enforce") {
    return {
      candidate: null,
      rankedCount: ranked.length,
      policyTrace: {
        mode,
        candidateKind: ranked[0]!.nudge.kind,
        allow: false,
        reason: "gmm.confidence_insufficient",
        wouldBlock: true,
        enforced: true,
      },
      evaluationChain: [],
      topRankedKind,
      selectedKind: null,
    };
  }

  if (lowConfidence && mode === "shadow") {
    return {
      candidate: ranked[0]!.nudge,
      rankedCount: ranked.length,
      policyTrace: {
        mode,
        candidateKind: ranked[0]!.nudge.kind,
        allow: true,
        reason: "gmm.confidence_fallback",
        wouldBlock: false,
        enforced: false,
      },
      evaluationChain: [],
      topRankedKind,
      selectedKind: ranked[0]!.nudge.kind,
    };
  }

  const policy = applyProactivePolicy({
    mental: input.mental,
    ranked,
    config: input.config as ConciergeConfig,
    offer: input.offer,
    payload: input.payload,
    now: input.now,
  });

  if (mode === "enforce") {
    const selected = ranked.find((row) => row.nudge.kind === policy.selectedKind);
    if (!selected) {
      const blocked = ranked[0]!;
      const verdict = policy.evaluations.find(
        (row) => row.kind === blocked.nudge.kind
      );
      return {
        candidate: null,
        rankedCount: ranked.length,
        policyTrace: {
          mode,
          candidateKind: blocked.nudge.kind,
          allow: false,
          reason: verdict?.reason ?? null,
          wouldBlock: true,
          enforced: true,
        },
        evaluationChain: policy.evaluations,
        topRankedKind,
        selectedKind: null,
      };
    }

    return {
      candidate: selected.nudge,
      rankedCount: ranked.length,
      policyTrace: {
        mode,
        candidateKind: selected.nudge.kind,
        allow: true,
        reason: null,
        wouldBlock: false,
        enforced: false,
      },
      evaluationChain: policy.evaluations,
      topRankedKind,
      selectedKind: selected.nudge.kind,
    };
  }

  const top = ranked[0]!;
  const verdict = evaluateProactivePolicyForKind({
    mental: input.mental,
    kind: top.nudge.kind,
    config: input.config as ConciergeConfig,
    offer: input.offer,
    payload: input.payload,
    now: input.now,
  });

  return {
    candidate: top.nudge,
    rankedCount: ranked.length,
    policyTrace: {
      mode,
      candidateKind: top.nudge.kind,
      allow: verdict.allow,
      reason: verdict.reason,
      wouldBlock: !verdict.allow,
      enforced: false,
    },
    evaluationChain: policy.evaluations,
    topRankedKind,
    selectedKind: top.nudge.kind,
  };
}
