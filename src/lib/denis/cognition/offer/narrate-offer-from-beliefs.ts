import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type BeliefGraph,
} from "@/lib/denis/cognition/beliefs/belief-types";
import type { OfferResolutionKind } from "@/lib/denis/cognition/offer/offer-types";

function isEnglish(language: string | null | undefined): boolean {
  const code = language?.trim().toLowerCase() ?? "sr";
  return code.startsWith("en");
}

function isGerman(language: string | null | undefined): boolean {
  return language?.trim().toLowerCase().startsWith("de") ?? false;
}

/** Chat-anchored recommend copy — parity with proactive enrich (GMM-11). */
export function narrateOfferFromBeliefs(
  beliefs: BeliefGraph,
  language?: string | null
): string | null {
  const ready =
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.offerReadinessReady) ===
    true;
  const productName = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.offerPrimaryProductName
  )?.trim();
  if (!ready || !productName) return null;

  const resolution = getBeliefValue<OfferResolutionKind | null>(
    beliefs,
    CORE_BELIEF_KEYS.offerResolution
  );
  const alternativeName = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.offerAlternativeProductName
  )?.trim();
  const primaryBlocked =
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.offerPrimaryKitchenBlocked) ===
    true;

  if (primaryBlocked && alternativeName) {
    if (isEnglish(language)) {
      return `${productName} is taking longer in the kitchen — I'd recommend ${alternativeName} instead. Shall I add it?`;
    }
    if (isGerman(language)) {
      return `${productName} dauert in der Küche gerade länger — ich würde stattdessen ${alternativeName} empfehlen. Soll ich es hinzufügen?`;
    }
    return `${productName} trenutno traje duže u kuhinji — preporučujem ${alternativeName}. Hoćete da dodam?`;
  }

  if (resolution === "return_view") {
    if (isEnglish(language)) {
      return `You seemed interested in ${productName} — I'd recommend it. Shall I add it?`;
    }
    if (isGerman(language)) {
      return `Sie schienen an ${productName} interessiert — ich würde es empfehlen. Soll ich es hinzufügen?`;
    }
    return `Primetio sam da ste gledali ${productName} — preporučujem ga. Hoćete da dodam?`;
  }

  if (isEnglish(language)) {
    return `Based on what you've been browsing, I'd recommend ${productName}. Shall I add it?`;
  }
  if (isGerman(language)) {
    return `Basierend auf Ihrem Blick durch die Karte empfehle ich ${productName}. Soll ich es hinzufügen?`;
  }
  return `Na osnovu vašeg gledanja, preporučujem ${productName}. Hoćete da dodam?`;
}
