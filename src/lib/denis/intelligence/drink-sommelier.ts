import type { GuestMealStage } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  classifyDrinkKnowledge,
  foodTagsFromProduct,
  type DrinkOccasion,
} from "@/lib/denis/kernel/vkg/drink-knowledge-graph";

export type SommelierPairingSuggestion = {
  primary: string;
  secondary?: string;
  occasion: DrinkOccasion;
  reason: string;
  foodName: string;
};

/** Typical minutes until a guest finishes a drink (refill prediction). */
export const DRINK_DURATION_MINUTES: Record<string, number> = {
  beer: 20,
  wine: 30,
  cocktail: 25,
  spirit: 35,
  coffee: 15,
  default: 20,
};

const FOOD_PAIRING_RULES: Array<{
  foodTags: string[];
  primary: string;
  secondary: string;
  reason: string;
}> = [
  {
    foodTags: ["steak", "beef", "grilled", "burger"],
    primary: "Cabernet Sauvignon",
    secondary: "Pilsner",
    reason: "bold red or crisp lager with grilled meat",
  },
  {
    foodTags: ["pizza", "pasta", "italian"],
    primary: "Chianti",
    secondary: "Pilsner",
    reason: "light red or lager with Italian dishes",
  },
  {
    foodTags: ["salad", "light"],
    primary: "Sauvignon Blanc",
    secondary: "Radler",
    reason: "light white or refreshing radler with salad",
  },
  {
    foodTags: ["fish"],
    primary: "Riesling",
    secondary: "Pilsner",
    reason: "semi-dry white or lager with fish",
  },
  {
    foodTags: ["asian"],
    primary: "Riesling",
    secondary: "Radler",
    reason: "off-dry white or radler with asian flavors",
  },
];

const APERITIF_SUGGESTIONS = ["Aperol Spritz", "Prosecco", "Pilsner 0.5L"];
const DIGESTIF_SUGGESTIONS = ["Grappa", "Limoncello", "Espresso"];

export function avgDrinkDurationMinutes(
  drinkName: string,
  metadata?: { drinkFamily?: string | null; menuSection?: string | null }
): number {
  const node = classifyDrinkKnowledge({
    productName: drinkName,
    drinkFamily: metadata?.drinkFamily ?? null,
    menuSection: metadata?.menuSection ?? "drinks",
  });
  switch (node.category) {
    case "beer":
      return DRINK_DURATION_MINUTES.beer;
    case "wine":
      return DRINK_DURATION_MINUTES.wine;
    case "cocktail":
      return DRINK_DURATION_MINUTES.cocktail;
    case "spirit":
      return DRINK_DURATION_MINUTES.spirit;
    case "coffee":
      return DRINK_DURATION_MINUTES.coffee;
    default:
      return DRINK_DURATION_MINUTES.default;
  }
}

export function resolveDrinkOccasion(input: {
  mealStage: GuestMealStage;
  hasFoodDelivered: boolean;
  hasOpenFoodOrder?: boolean;
}): DrinkOccasion | null {
  const { mealStage, hasFoodDelivered } = input;

  if (mealStage === "post_meal" || mealStage === "dessert_window") {
    return "digestif";
  }

  if (
    mealStage === "pre_order" ||
    mealStage === "aperitif" ||
    (!hasFoodDelivered && !input.hasOpenFoodOrder)
  ) {
    return "aperitif";
  }

  if (
    mealStage === "main" ||
    mealStage === "between_courses" ||
    hasFoodDelivered ||
    input.hasOpenFoodOrder
  ) {
    return "pairing";
  }

  return null;
}

/** Digestif never before food — guard for situational offers. */
export function isOccasionAllowed(
  occasion: DrinkOccasion,
  mealStage: GuestMealStage,
  hasFoodDelivered: boolean
): boolean {
  if (occasion === "digestif") {
    return (
      hasFoodDelivered &&
      (mealStage === "post_meal" ||
        mealStage === "dessert_window" ||
        mealStage === "between_courses")
    );
  }
  if (occasion === "aperitif") {
    return !hasFoodDelivered || mealStage === "aperitif" || mealStage === "pre_order";
  }
  return true;
}

export function suggestDrinksForFood(
  foodName: string,
  occasion: DrinkOccasion = "pairing",
  foodTags: string[] = []
): SommelierPairingSuggestion | null {
  if (occasion === "aperitif") {
    return {
      primary: APERITIF_SUGGESTIONS[0]!,
      secondary: APERITIF_SUGGESTIONS[1],
      occasion: "aperitif",
      reason: "aperitif before meal",
      foodName,
    };
  }

  if (occasion === "digestif") {
    return {
      primary: DIGESTIF_SUGGESTIONS[0]!,
      secondary: DIGESTIF_SUGGESTIONS[1],
      occasion: "digestif",
      reason: "digestif after meal",
      foodName,
    };
  }

  const tags = foodTagsFromProduct({ foodName, foodTags });
  for (const rule of FOOD_PAIRING_RULES) {
    if (!rule.foodTags.some((tag) => tags.includes(tag))) continue;
    return {
      primary: rule.primary,
      secondary: rule.secondary,
      occasion: "pairing",
      reason: rule.reason,
      foodName,
    };
  }

  if (tags.includes("steak") || tags.includes("beef")) {
    return {
      primary: "Cabernet Sauvignon",
      secondary: "Pilsner",
      occasion: "pairing",
      reason: "bold red or lager with meat",
      foodName,
    };
  }

  return null;
}

export function formatSommelierPairingMessage(input: {
  suggestion: SommelierPairingSuggestion;
  language?: string | null;
}): string {
  const lang = input.language?.trim().slice(0, 2) ?? "sr";
  const { primary, secondary, foodName } = input.suggestion;
  const options = secondary ? `${primary} ili ${secondary}` : primary;

  if (lang === "de") {
    return secondary
      ? `Zu ${foodName}: ${primary} oder ${secondary}?`
      : `Zu ${foodName}: ${primary}?`;
  }
  if (lang === "en") {
    return secondary
      ? `With ${foodName}: ${primary} or ${secondary}?`
      : `With ${foodName}: ${primary}?`;
  }
  return `Uz ${foodName}: ${options}?`;
}

export function formatSommelierRefillMessage(input: {
  drinkName: string;
  language?: string | null;
}): string {
  const lang = input.language?.trim().slice(0, 2) ?? "sr";
  const drink = input.drinkName.trim() || "piće";

  if (lang === "de") {
    return `Wie schmeckt ${drink}? Noch eins?`;
  }
  if (lang === "en") {
    return `How's the ${drink}? Want another?`;
  }
  return `Kako je ${drink}? Još jedno?`;
}

export function formatPartyDrinkGapMessage(input: {
  language?: string | null;
}): string {
  const lang = input.language?.trim().slice(0, 2) ?? "sr";
  if (lang === "de") return "Darf es für Sie auch etwas zu trinken sein?";
  if (lang === "en") return "Would you like something to drink too?";
  return "I za vas nešto za piti?";
}
