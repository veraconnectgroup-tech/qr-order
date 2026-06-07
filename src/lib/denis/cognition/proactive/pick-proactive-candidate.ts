import { applyProactivePolicy, evaluateProactivePolicyForKind } from "@/lib/denis/cognition/proactive/apply-proactive-policy";
import type { ProactivePolicyReason } from "@/lib/denis/cognition/proactive/proactive-policy-types";
import {
  rankProactiveCandidates,
  type RankProactiveCandidatesInput,
} from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
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
};

/** Rank → policy manifest → first allowed (ADR-038 GMM-6). */
export function pickProactiveCandidate(
  input: RankProactiveCandidatesInput
): PickProactiveCandidateResult {
  const ranked = rankProactiveCandidates(input);
  const config = input.config as ConciergeConfig;
  const mode = resolveMentalModelMode(config);
  const confidenceFallback = config.mentalModel.confidenceFallbackThreshold;

  if (ranked.length === 0) {
    return { candidate: null, rankedCount: 0, policyTrace: null };
  }

  const lowConfidence =
    input.mental != null &&
    mode !== "off" &&
    input.mental.confidence < confidenceFallback;

  if (mode === "off" || !input.mental || lowConfidence) {
    return {
      candidate: ranked[0]!.nudge,
      rankedCount: ranked.length,
      policyTrace:
        lowConfidence && mode === "shadow"
          ? {
              mode,
              candidateKind: ranked[0]!.nudge.kind,
              allow: true,
              reason: "gmm.confidence_fallback",
              wouldBlock: false,
              enforced: false,
            }
          : null,
    };
  }

  const policy = applyProactivePolicy({
    mental: input.mental,
    ranked,
    config: input.config as ConciergeConfig,
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
    };
  }

  // shadow — top ranked for emit, policy trace for observability
  const top = ranked[0]!;
  const verdict = evaluateProactivePolicyForKind({
    mental: input.mental,
    kind: top.nudge.kind,
    config: input.config as ConciergeConfig,
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
  };
}

/** Legacy API — highest-ranked eligible candidate (no enforce). */
export function detectProactiveCandidate(
  input: RankProactiveCandidatesInput
): GuestProactiveNudge | null {
  return rankProactiveCandidates(input)[0]?.nudge ?? null;
}
