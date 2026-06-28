import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { detectGuestMessageLanguage } from "@/lib/ai/config";
import { isProductHiddenByAllergenFilter } from "@/lib/allergens";
import type { AllergenId } from "@/lib/allergens";
import { emitTurnLearningEvents } from "@/lib/denis/platform/emit-turn-learning-events";
import type { GuestIntent } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

function countAllergenExcludedFoodProducts(input: {
  productNames: string[];
  productAllergens: string[][];
  blockedAllergens: AllergenId[];
}): number {
  if (input.blockedAllergens.length === 0) return 0;
  let excluded = 0;
  for (let i = 0; i < input.productNames.length; i++) {
    const allergens = input.productAllergens[i] ?? [];
    if (isProductHiddenByAllergenFilter(allergens, new Set(input.blockedAllergens))) {
      excluded += 1;
    }
  }
  return excluded;
}

/** Collect operator learning signals after a Denis chat turn (runtime spine). */
export async function maybeEmitTurnLearningSignals(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    locationId: string;
    guestMessage: string;
    legacyIntent?: string | null;
    guestIntent: GuestIntent | string;
    menuLanguage: string;
    guestAllergens?: string[];
    cartChanged: boolean;
    orderSubmitted: boolean;
  }
): Promise<void> {
  let productNames: string[] = [];
  let productAllergens: string[][] = [];
  try {
    const menu = await getCachedMenuForLocation(input.locationId);
    productNames = Object.values(menu.catalog ?? {}).map((product) => product.name);
    productAllergens = Object.values(menu.catalog ?? {}).map(
      (product) => product.allergens ?? []
    );
  } catch {
    productNames = [];
    productAllergens = [];
  }

  const languageDetection = detectGuestMessageLanguage(
    input.guestMessage,
    input.menuLanguage
  );

  const blockedAllergens = (input.guestAllergens ?? [])
    .map((value) => value.trim())
    .filter(Boolean) as AllergenId[];

  await emitTurnLearningEvents(admin, {
    aiSessionId: input.aiSessionId,
    traceId: input.traceId,
    locationId: input.locationId,
    detectInput: {
      guestMessage: input.guestMessage,
      legacyIntent: input.legacyIntent,
      guestIntent: input.guestIntent,
      productNames,
      guestAllergens: input.guestAllergens,
      excludedFoodCount: countAllergenExcludedFoodProducts({
        productNames,
        productAllergens,
        blockedAllergens,
      }),
      languageUnsupported: languageDetection.detected === "unknown",
      unsupportedLanguage: languageDetection.detected,
      cartChanged: input.cartChanged,
      orderSubmitted: input.orderSubmitted,
    },
  });
}
