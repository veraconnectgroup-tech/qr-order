import type {
  EvaluateInterventionInput,
  InterventionDecision,
  MatchedInterventionRule,
  MentalPredicate,
  OfferPredicate,
  TrajectoryPredicate,
} from "@/lib/denis/cognition/intervention/intervention-types";
import type { SessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { OfferTiming } from "@/lib/denis/cognition/offer/offer-types";
import type { InterventionManifest } from "@/lib/denis/cognition/intervention/intervention-types";

function matchesTrajectory(
  predicate: TrajectoryPredicate | undefined,
  trajectory: SessionTrajectory
): boolean {
  if (!predicate) return true;
  if (predicate.ordering && trajectory.ordering !== predicate.ordering) {
    return false;
  }
  if (predicate.engagement && trajectory.engagement !== predicate.engagement) {
    return false;
  }
  if (predicate.meal && trajectory.meal !== predicate.meal) {
    return false;
  }
  if (
    predicate.minOpportunity != null &&
    trajectory.opportunity < predicate.minOpportunity
  ) {
    return false;
  }
  if (
    predicate.maxInterruptionRisk != null &&
    trajectory.interruptionRisk > predicate.maxInterruptionRisk
  ) {
    return false;
  }
  return true;
}

function matchesMental(
  predicate: MentalPredicate | undefined,
  mental: GuestMentalModel
): boolean {
  if (!predicate) return true;
  if (predicate.predictedNeed && mental.predictedNeed !== predicate.predictedNeed) {
    return false;
  }
  if (predicate.intent && mental.intent !== predicate.intent) {
    return false;
  }
  if (predicate.receptiveness && mental.receptiveness !== predicate.receptiveness) {
    return false;
  }
  if (predicate.mealStage && mental.mealStage !== predicate.mealStage) {
    return false;
  }
  if (
    predicate.scrollSearching != null &&
    mental.scrollPosture.searching !== predicate.scrollSearching
  ) {
    return false;
  }
  if (
    predicate.scrollDeferUpsell != null &&
    mental.scrollPosture.deferUpsell !== predicate.scrollDeferUpsell
  ) {
    return false;
  }
  if (
    predicate.scrollReadyForRecommendation != null &&
    mental.scrollPosture.readyForRecommendation !==
      predicate.scrollReadyForRecommendation
  ) {
    return false;
  }
  return true;
}

function matchesOffer(
  predicate: OfferPredicate | undefined,
  timing: OfferTiming | null | undefined
): boolean {
  if (!predicate) return true;
  if (predicate.timingReady != null && Boolean(timing?.ready) !== predicate.timingReady) {
    return false;
  }
  if (predicate.timingKind && timing?.kind !== predicate.timingKind) {
    return false;
  }
  return true;
}

export function matchInterventionRules(input: {
  manifest: InterventionManifest;
  trajectory: SessionTrajectory;
  mental: GuestMentalModel;
  offerTiming: OfferTiming | null | undefined;
}): MatchedInterventionRule[] {
  const matched: MatchedInterventionRule[] = [];

  for (const rule of input.manifest.rules) {
    if (!matchesTrajectory(rule.when.trajectory, input.trajectory)) continue;
    if (!matchesMental(rule.when.mental, input.mental)) continue;
    if (!matchesOffer(rule.when.offer, input.offerTiming)) continue;

    matched.push({
      ruleId: rule.id,
      allowKinds: rule.allow.kinds,
      riskClass: rule.allow.riskClass,
    });
  }

  return matched;
}

export function buildEvidenceSignature(
  trajectory: SessionTrajectory,
  matchedRuleIds: string[]
): string {
  const atoms = [...trajectory.evidence].sort().join("|");
  const rules = [...matchedRuleIds].sort().join(",");
  return `e:${atoms || "none"};r:${rules || "none"}`;
}

function deriveIjsDecision(
  matched: MatchedInterventionRule[],
  trajectory: SessionTrajectory
): InterventionDecision {
  if (matched.length === 0) return "silence";
  if (trajectory.interruptionRisk >= 0.75) return "silence";
  if (trajectory.opportunity < 0.25) return "silence";
  return "speak";
}

/** Evaluate manifest against folded trajectory (pure). */
export function evaluateInterventionManifest(
  input: EvaluateInterventionInput
): {
  matchedRules: MatchedInterventionRule[];
  ijsDecision: InterventionDecision;
  ruleId: string | null;
  evidenceSignature: string;
  silenceReason: string | null;
} {
  const matchedRules = matchInterventionRules({
    manifest: input.manifest,
    trajectory: input.trajectory,
    mental: input.mental,
    offerTiming: input.offerTiming,
  });

  const ijsDecision = deriveIjsDecision(matchedRules, input.trajectory);
  const ruleId = matchedRules[0]?.ruleId ?? null;
  const matchedRuleIds = matchedRules.map((row) => row.ruleId);
  const evidenceSignature = buildEvidenceSignature(
    input.trajectory,
    matchedRuleIds
  );

  let silenceReason: string | null = null;
  if (ijsDecision === "silence") {
    if (matchedRules.length === 0) {
      silenceReason = "ijs.no_rule_match";
    } else if (input.trajectory.interruptionRisk >= 0.75) {
      silenceReason = "ijs.interruption_risk_high";
    } else if (input.trajectory.opportunity < 0.25) {
      silenceReason = "ijs.opportunity_low";
    } else {
      silenceReason = "ijs.prefer_silence";
    }
  }

  return {
    matchedRules,
    ijsDecision,
    ruleId,
    evidenceSignature,
    silenceReason,
  };
}
