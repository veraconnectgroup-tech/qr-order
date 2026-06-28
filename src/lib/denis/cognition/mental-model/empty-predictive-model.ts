import type { GuestPredictiveModel } from "@/lib/denis/cognition/mental-model/mental-model-types";

export function emptyGuestPredictiveModel(): GuestPredictiveModel {
  return {
    nextAction: {
      action: "none",
      probability: 0,
      label: "",
      preloadProducts: [],
      triggerProactiveHelp: false,
    },
    trajectory: {
      partySize: 1,
      predictedMains: 1,
      predictedDrinks: 1,
      predictedDessert: false,
      plannedSteps: ["greet", "drinks", "mains", "bill"],
      currentStep: "greet",
      confidence: 0.2,
    },
    spend: {
      tier: "mid",
      predictedTotalCents: 2500,
      perGuestCents: 2500,
      confidence: 0.2,
      upsellTier: "standard",
    },
    duration: {
      predictedMinutes: 60,
      mode: "normal",
      confidence: 0.2,
      priorSource: "heuristic",
    },
  };
}
