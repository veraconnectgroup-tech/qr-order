import type {
  GuestAffect,
  GuestFusionStyle,
  GuestIntent,
  GuestIntentTransition,
  GuestMealStage,
  GuestPace,
  GuestPredictedNeed,
  GuestReadiness,
  GuestReceptiveness,
} from "@/lib/denis/cognition/mental-model/mental-model-types";

function receptivenessAtLeastOpen(receptiveness: GuestReceptiveness): boolean {
  return receptiveness === "open" || receptiveness === "enthusiastic";
}

function frustrationEscalates(
  affect: GuestAffect | undefined,
  threshold: "mild" | "high"
): boolean {
  const level = affect?.frustration.level ?? "none";
  if (level === "high") return true;
  if (threshold === "mild" && level === "mild") return true;
  return false;
}

/** Cross-signal Denis tone — fusion layer (Prompt 92). */
export function deriveFusionStyle(input: {
  pace: GuestPace;
  receptiveness: GuestReceptiveness;
  intent: GuestIntent;
  affect?: GuestAffect;
  readiness: GuestReadiness;
  abnormalTransition: GuestIntentTransition | null;
}): GuestFusionStyle {
  if (
    input.abnormalTransition &&
    (input.abnormalTransition.from === "eating" ||
      input.abnormalTransition.from === "finishing") &&
    input.abnormalTransition.to === "ordering"
  ) {
    return "reorder_during_meal";
  }

  if (input.pace === "rushed" && receptivenessAtLeastOpen(input.receptiveness)) {
    return "short_direct";
  }

  if (
    input.pace === "relaxed" &&
    input.receptiveness === "enthusiastic"
  ) {
    return "detailed_storytelling";
  }

  if (
    input.intent === "exploring" &&
    input.affect?.frustration.level === "mild"
  ) {
    return "helpful_discovery";
  }

  if (input.readiness.band === "low") {
    return "wait";
  }

  return "default";
}

/** Optional proactive copy hint from fused signals. */
export function synthesizeFusionHint(input: {
  style: GuestFusionStyle;
  intent: GuestIntent;
  affect?: GuestAffect;
}): string | null {
  if (input.style === "helpful_discovery") {
    return "Mozda da vam pomognem? Sta inace volite?";
  }
  if (input.style === "short_direct") {
    return "Kratke, direktne preporuke — bez small talka.";
  }
  if (input.style === "detailed_storytelling") {
    return "Detaljne price o jelu i vinu.";
  }
  if (input.style === "reorder_during_meal") {
    return "Jos nesto uz obrok?";
  }
  if (
    input.intent === "exploring" &&
    input.affect?.frustration.level === "mild"
  ) {
    return "Mozda da vam pomognem? Sta inace volite?";
  }
  return null;
}

/** Synthesis layer — cross-signal predicted need (ADR-038 Val B/C + Prompt 92). */
export function synthesizePredictedNeed(input: {
  intent: GuestIntent;
  mealStage: GuestMealStage;
  receptiveness: GuestReceptiveness;
  pace: GuestPace;
  affect?: GuestAffect;
  frustrationEscalateThreshold?: "mild" | "high";
  anomalies?: Array<{ suggestedAction: string }>;
}): GuestPredictedNeed {
  if (
    input.intent === "exploring" &&
    input.affect?.frustration.level === "mild"
  ) {
    return "needs_help_choosing";
  }

  if (
    frustrationEscalates(
      input.affect,
      input.frustrationEscalateThreshold ?? "high"
    )
  ) {
    return "needs_attention";
  }

  const comparisonAnomaly = input.anomalies?.some(
    (row) => row.suggestedAction === "offer_comparison"
  );
  if (comparisonAnomaly || input.pace === "indecisive") {
    return "needs_help_choosing";
  }

  if (input.mealStage === "paying" || input.intent === "paying" || input.intent === "finishing") {
    return "wants_bill";
  }

  if (input.mealStage === "dessert_window") return "wants_dessert";

  if (input.mealStage === "post_meal") return "wants_bill";

  if (
    input.mealStage === "aperitif" ||
    (input.mealStage === "between_courses" &&
      (input.intent === "exploring" || input.intent === "comparing"))
  ) {
    return "wants_drink";
  }

  if (input.intent === "decided" || input.intent === "ordering") {
    return "ready_to_order";
  }

  if (
    (input.intent === "exploring" || input.intent === "comparing") &&
    (receptivenessAtLeastOpen(input.receptiveness) ||
      input.receptiveness === "enthusiastic")
  ) {
    return "needs_help_choosing";
  }

  if (input.intent === "waiting_food" || input.intent === "eating") {
    return "none";
  }

  return "none";
}
