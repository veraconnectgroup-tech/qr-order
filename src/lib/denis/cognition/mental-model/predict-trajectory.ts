import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type {
  GuestIntent,
  GuestMealStage,
  GuestTrajectoryPrediction,
  GuestTrajectoryStep,
} from "@/lib/denis/cognition/mental-model/mental-model-types";

const FOR_TWO_PATTERN =
  /\b(za dvoje|for two|we are two|nas dvoje|we.?re two|table for 2)\b/i;

function resolveCurrentStep(input: {
  mealStage: GuestMealStage;
  intent: GuestIntent;
  browsedDrinks: boolean;
  browsedFood: boolean;
}): GuestTrajectoryStep {
  if (
    input.mealStage === "paying" ||
    input.intent === "paying" ||
    input.intent === "finishing"
  ) {
    return "bill";
  }
  if (
    input.mealStage === "dessert_window" ||
    input.mealStage === "post_meal"
  ) {
    return "dessert";
  }
  if (
    input.mealStage === "main" ||
    input.intent === "waiting_food" ||
    input.intent === "eating"
  ) {
    return "mains";
  }
  if (
    input.mealStage === "aperitif" ||
    input.browsedDrinks ||
    input.intent === "exploring"
  ) {
    return input.browsedFood ? "mains" : "drinks";
  }
  return "greet";
}

/** Plan the full meal arc — greet → drinks → mains → dessert → bill (L2). */
export function predictMealTrajectory(input: {
  browse: GuestBrowseProfile;
  partySize: number;
  mealStage: GuestMealStage;
  intent: GuestIntent;
  lastGuestText?: string | null;
}): GuestTrajectoryPrediction {
  const forTwo = FOR_TWO_PATTERN.test(input.lastGuestText ?? "");
  const partySize = forTwo
    ? Math.max(2, input.partySize)
    : Math.max(1, input.partySize);

  const browsingMains =
    input.browse.browsedFood ||
    input.browse.dominantMenuSection === "food";

  const predictedMains = browsingMains ? partySize : Math.max(1, partySize);
  const predictedDrinks = partySize;
  const predictedDessert =
    partySize >= 2 &&
    (input.browse.browsedDesserts || input.mealStage === "dessert_window");

  const plannedSteps: GuestTrajectoryStep[] = ["greet", "drinks", "mains"];
  if (predictedDessert) plannedSteps.push("dessert");
  plannedSteps.push("bill");

  const currentStep = resolveCurrentStep({
    mealStage: input.mealStage,
    intent: input.intent,
    browsedDrinks: input.browse.browsedDrinks,
    browsedFood: input.browse.browsedFood,
  });

  let confidence = 0.45;
  if (forTwo && browsingMains) confidence = 0.82;
  else if (forTwo) confidence = 0.7;
  else if (browsingMains) confidence = 0.6;

  return {
    partySize,
    predictedMains,
    predictedDrinks,
    predictedDessert,
    plannedSteps,
    currentStep,
    confidence: Math.round(confidence * 100) / 100,
  };
}
