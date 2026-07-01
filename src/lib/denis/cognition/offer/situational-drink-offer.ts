import type { GuestMealStage } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  isOccasionAllowed,
  resolveDrinkOccasion,
  suggestDrinksForFood,
  type SommelierPairingSuggestion,
} from "@/lib/denis/intelligence/drink-sommelier";

export type SituationalDrinkOfferInput = {
  mealStage: GuestMealStage;
  hasFoodDelivered: boolean;
  hasOpenFoodOrder?: boolean;
  foodName?: string | null;
  vkgDrinkName?: string | null;
};

/** Occasion-aware drink offer — aperitif / pairing / digestif with timing guards. */
export function resolveSituationalDrinkOffer(
  input: SituationalDrinkOfferInput
): SommelierPairingSuggestion | null {
  const occasion = resolveDrinkOccasion({
    mealStage: input.mealStage,
    hasFoodDelivered: input.hasFoodDelivered,
    hasOpenFoodOrder: input.hasOpenFoodOrder,
  });

  if (!occasion || !isOccasionAllowed(occasion, input.mealStage, input.hasFoodDelivered)) {
    return null;
  }

  const foodName = input.foodName?.trim();
  if (foodName) {
    const fromRules = suggestDrinksForFood(foodName, occasion);
    if (fromRules) return fromRules;
  }

  if (occasion === "aperitif" && !foodName) {
    return suggestDrinksForFood("meal", "aperitif");
  }

  if (occasion === "pairing" && input.vkgDrinkName?.trim()) {
    return {
      primary: input.vkgDrinkName.trim(),
      occasion: "pairing",
      reason: "VKG pairing",
      foodName: foodName ?? "jelo",
    };
  }

  if (occasion === "digestif") {
    return suggestDrinksForFood("meal", "digestif");
  }

  return null;
}
