import type {
  GuestAffect,
  GuestIntent,
  GuestMealStage,
  GuestPace,
  GuestPredictedNeed,
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

/** Synthesis layer — what Denis should do next (ADR-038 Val B/C). */
export function synthesizePredictedNeed(input: {
  intent: GuestIntent;
  mealStage: GuestMealStage;
  receptiveness: GuestReceptiveness;
  pace: GuestPace;
  affect?: GuestAffect;
  frustrationEscalateThreshold?: "mild" | "high";
}): GuestPredictedNeed {
  if (
    frustrationEscalates(
      input.affect,
      input.frustrationEscalateThreshold ?? "high"
    )
  ) {
    return "needs_attention";
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
      input.pace === "indecisive" ||
      input.receptiveness === "enthusiastic")
  ) {
    return "needs_help_choosing";
  }

  if (input.intent === "waiting_food" || input.intent === "eating") {
    return "none";
  }

  return "none";
}
