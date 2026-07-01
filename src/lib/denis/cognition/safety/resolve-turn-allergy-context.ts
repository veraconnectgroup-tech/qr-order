import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import type { MenuRagCatalog } from "@/lib/denis/cognition/context/menu-rag-types";
import {
  catalogToAllergyGuardProducts,
  checkAllergyConflict,
  isAllergyAcknowledged,
  mergeAllergieLabelSets,
  parseAllergenExclusionsFromText,
  resolveKnownAllergenIds,
  type AllergyGuardResult,
} from "@/lib/denis/cognition/safety/allergy-guard";
import type { WaiterGapKind } from "@/lib/denis/cognition/waiter/waiter-obligation-types";
import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

export type TurnAllergyContext = {
  guard: AllergyGuardResult;
  allergyAcknowledged: boolean;
  knownAllergieLabels: string[];
};

export async function resolveTurnAllergyContext(input: {
  locationId: string;
  cartLines: DenisCartLine[];
  guestMemory?: GuestMemoryProjection | null;
  guestMessage: string;
  language: string;
  priorPrimaryGap?: WaiterGapKind | null;
  catalog?: MenuRagCatalog | null;
}): Promise<TurnAllergyContext> {
  const detected = parseAllergenExclusionsFromText(input.guestMessage);
  const knownAllergieLabels = mergeAllergieLabelSets(
    input.guestMemory?.allergyLabels ?? [],
    detected
  );
  const knownAllergens = resolveKnownAllergenIds(knownAllergieLabels);

  if (input.cartLines.length === 0 || knownAllergens.length === 0) {
    return {
      guard: { safe: true, conflicts: [], message: null },
      allergyAcknowledged: false,
      knownAllergieLabels,
    };
  }

  let catalog = input.catalog;
  if (!catalog) {
    try {
      const menuCache = await getCachedMenuForLocation(input.locationId);
      catalog = menuCache.catalog;
    } catch {
      catalog = null;
    }
  }

  if (!catalog || Object.keys(catalog).length === 0) {
    return {
      guard: { safe: true, conflicts: [], message: null },
      allergyAcknowledged: false,
      knownAllergieLabels,
    };
  }

  const guard = checkAllergyConflict({
    cartItems: input.cartLines,
    knownAllergens,
    products: catalogToAllergyGuardProducts(catalog),
    language: input.language,
  });

  const allergyAcknowledged =
    input.priorPrimaryGap === "allergy_warning" &&
    isAllergyAcknowledged(input.guestMessage);

  return {
    guard,
    allergyAcknowledged,
    knownAllergieLabels,
  };
}
