import type { AbandonmentRiskScore } from "@/lib/denis/cognition/offer/abandonment-risk-scorer";
import {
  derivePreventionFatigue,
  type PreventionFatigueState,
} from "@/lib/denis/cognition/mental-model/derive-session-nudge-fatigue";
import type { NudgeOutcomeKind } from "@/lib/denis/cognition/offer/nudge-outcome-types";

export type PreventionInterventionKind =
  | "price_shock_alternative"
  | "decision_paralysis"
  | "distraction_nudge";

export type PreventionIntervention = {
  kind: PreventionInterventionKind;
  message: string;
  dismissKey: string;
  riskScore: number;
  productId?: string | null;
  productName?: string | null;
};

export const MAX_PREVENTION_PER_SESSION = 1;
export const PREVENTION_OPTIMAL_MIN_SEC = 60;
export const PREVENTION_OPTIMAL_MAX_SEC = 180;
export const DECISION_PARALYSIS_CYCLE_MIN = 3;

const DEFAULT_VENUE_AVG_IDLE_SEC = 120;

function isEnglish(language: string | null | undefined): boolean {
  return (language?.trim().toLowerCase() ?? "sr").startsWith("en");
}

function formatEur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/** Smart timing — 60–180s after last interaction (venue-adjusted). */
export function isPreventionTimingOptimal(input: {
  lastInteractionMs: number;
  venueAvgSessionIdleSec?: number | null;
}): boolean {
  const idleSec = Math.max(0, input.lastInteractionMs / 1000);
  const venueAvg = input.venueAvgSessionIdleSec ?? DEFAULT_VENUE_AVG_IDLE_SEC;
  const minSec = Math.max(PREVENTION_OPTIMAL_MIN_SEC, venueAvg * 0.5);
  const maxSec = Math.max(PREVENTION_OPTIMAL_MAX_SEC, venueAvg * 1.5);
  return idleSec >= minSec && idleSec <= maxSec;
}

function pickInterventionKind(input: {
  risk: AbandonmentRiskScore;
  addRemoveCycleCount: number;
}): PreventionInterventionKind | null {
  if (
    input.addRemoveCycleCount >= DECISION_PARALYSIS_CYCLE_MIN ||
    (input.risk.signals.includes("add_remove_cycles") &&
      input.addRemoveCycleCount >= 2)
  ) {
    return "decision_paralysis";
  }

  if (input.risk.signals.includes("price_above_avg_spend")) {
    return "price_shock_alternative";
  }

  if (
    input.risk.signals.includes("cart_idle_3min") ||
    input.risk.signals.includes("stopped_interacting")
  ) {
    return "distraction_nudge";
  }

  if (input.risk.signals.includes("scrolled_past_checkout")) {
    return "distraction_nudge";
  }

  return "distraction_nudge";
}

function buildPriceShockMessage(input: {
  english: boolean;
  primaryName: string;
  alternativeName: string;
  alternativePriceCents: number;
}): string {
  if (input.english) {
    return `We also have a smaller ${input.alternativeName} for ${formatEur(input.alternativePriceCents)} — just as tasty!`;
  }
  return `Imamo i manji ${input.alternativeName} za ${formatEur(input.alternativePriceCents)} — isto ukusan!`;
}

function buildDecisionParalysisMessage(input: {
  english: boolean;
  popularName: string;
}): string {
  if (input.english) {
    return `Tough choice? ${input.popularName} is our most popular pick!`;
  }
  return `Težak izbor? ${input.popularName} je naš najpopularniji!`;
}

function buildDistractionMessage(input: {
  english: boolean;
}): string {
  if (input.english) {
    return "Still here? Your cart is waiting 🙂";
  }
  return "Još ste tu? Vaša korpa čeka 🙂";
}

export type ResolvePreventionInterventionInput = {
  risk: AbandonmentRiskScore;
  lastInteractionMs: number;
  venueAvgSessionIdleSec?: number | null;
  preventionAttemptCount: number;
  usedInterventionKinds: PreventionInterventionKind[];
  preventionIgnored: boolean;
  respectDecline?: boolean;
  nudgeOutcomes?: NudgeOutcomeKind[];
  addRemoveCycleCount?: number;
  language?: string | null;
  primaryCartItem?: { productId: string; productName: string } | null;
  cheaperAlternative?: {
    productId: string;
    productName: string;
    priceCents: number;
  } | null;
  popularProduct?: { productId: string; productName: string } | null;
};

export type PreventionResolution = {
  intervention: PreventionIntervention | null;
  fatigue: PreventionFatigueState;
};

/** Pre-emptive intervention — prevention, not post-abandon recovery. */
export function resolvePreventionIntervention(
  input: ResolvePreventionInterventionInput
): PreventionResolution {
  const kind = pickInterventionKind({
    risk: input.risk,
    addRemoveCycleCount: input.addRemoveCycleCount ?? 0,
  });

  const fatigue = derivePreventionFatigue({
    preventionEmitCount: input.preventionAttemptCount,
    preventionIgnored: input.preventionIgnored,
    usedInterventionKinds: input.usedInterventionKinds,
    nextKind: kind,
    respectDecline: input.respectDecline ?? true,
    nudgeOutcomes: input.nudgeOutcomes ?? [],
  });

  if (fatigue.blocked) {
    return { intervention: null, fatigue };
  }

  if (!input.risk.intervene) {
    return { intervention: null, fatigue };
  }

  if (
    !isPreventionTimingOptimal({
      lastInteractionMs: input.lastInteractionMs,
      venueAvgSessionIdleSec: input.venueAvgSessionIdleSec,
    })
  ) {
    return { intervention: null, fatigue };
  }

  if (!kind) {
    return { intervention: null, fatigue };
  }

  const english = isEnglish(input.language);
  let message: string | null = null;
  let productId: string | null = null;
  let productName: string | null = null;

  switch (kind) {
    case "price_shock_alternative": {
      const alt = input.cheaperAlternative;
      const primary = input.primaryCartItem;
      if (alt && primary) {
        message = buildPriceShockMessage({
          english,
          primaryName: primary.productName,
          alternativeName: alt.productName,
          alternativePriceCents: alt.priceCents,
        });
        productId = alt.productId;
        productName = alt.productName;
      }
      break;
    }
    case "decision_paralysis": {
      const popular = input.popularProduct ?? input.primaryCartItem;
      if (popular) {
        message = buildDecisionParalysisMessage({
          english,
          popularName: popular.productName,
        });
        productId = popular.productId;
        productName = popular.productName;
      }
      break;
    }
    case "distraction_nudge":
      message = buildDistractionMessage({ english });
      break;
    default:
      break;
  }

  if (!message) {
    return { intervention: null, fatigue };
  }

  return {
    intervention: {
      kind,
      message,
      dismissKey: `prevention:${kind}:${productId ?? "generic"}`,
      riskScore: input.risk.score,
      productId,
      productName,
    },
    fatigue,
  };
}

export function countPreventionEmits(input: {
  outcomes: Array<{ nudgeKind: string }>;
  pending: Array<{ nudgeKind: string }>;
}): number {
  const kind = "cart_abandonment_prevention";
  const emitted = input.outcomes.filter((row) => row.nudgeKind === kind).length;
  const pending = input.pending.filter((row) => row.nudgeKind === kind).length;
  return emitted + pending;
}

export function usedPreventionKinds(input: {
  outcomes: Array<{ nudgeKind: string; offerResolution?: string | null }>;
  pending: Array<{ nudgeKind: string }>;
}): PreventionInterventionKind[] {
  const kinds = new Set<PreventionInterventionKind>();
  const records = [...input.outcomes, ...input.pending].filter(
    (row) => row.nudgeKind === "cart_abandonment_prevention"
  );

  for (const row of records) {
    const resolution = (row as { offerResolution?: string }).offerResolution;
    if (
      resolution === "price_shock_alternative" ||
      resolution === "decision_paralysis" ||
      resolution === "distraction_nudge"
    ) {
      kinds.add(resolution);
    }
  }

  return [...kinds];
}
