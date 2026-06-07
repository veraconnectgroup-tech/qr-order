import type {
  GuestOfferContext,
  OfferResolutionKind,
  ResolvedOffer,
} from "@/lib/denis/cognition/offer/offer-types";

export type NarrateOfferInput = {
  offer: GuestOfferContext;
  language?: string | null;
  /** When true, prefer kitchen-alternative copy when primary is blocked. */
  preferKitchenAlternative?: boolean;
};

function isEnglish(language: string | null | undefined): boolean {
  const code = language?.trim().toLowerCase() ?? "sr";
  return code.startsWith("en");
}

function productLabel(offer: ResolvedOffer): string {
  return offer.productName.trim();
}

function narrateTopDwell(productName: string, english: boolean): string {
  if (english) {
    return `I noticed you were looking at ${productName} — great choice. Shall I add it?`;
  }
  return `Vidim da ste gledali ${productName} — odličan izbor. Hoćete da dodam?`;
}

function narrateReturnView(productName: string, english: boolean): string {
  if (english) {
    return `You came back to ${productName} — shall I add it for you?`;
  }
  return `Primetio sam da se vraćate na ${productName} — hoćete da dodam?`;
}

function narrateCartRecovery(productName: string, english: boolean): string {
  if (english) {
    return `I saw you removed ${productName} from the cart — want me to add it back?`;
  }
  return `Video sam da ste uklonili ${productName} iz korpe — hoćete da vam ga dodam?`;
}

function narrateKitchenAlternative(input: {
  primaryName: string;
  alternativeName: string;
  english: boolean;
}): string {
  if (input.english) {
    return `${input.primaryName} is taking longer in the kitchen right now — ${input.alternativeName} arrives sooner. Shall I add it?`;
  }
  return `${input.primaryName} trenutno traje duže u kuhinji — ${input.alternativeName} stiže brže. Hoćete da dodam?`;
}

function narrateByResolution(
  resolution: OfferResolutionKind,
  productName: string,
  english: boolean
): string {
  switch (resolution) {
    case "return_view":
      return narrateReturnView(productName, english);
    case "cart_recovery":
      return narrateCartRecovery(productName, english);
    case "kitchen_alternative":
    case "top_dwell":
    case "category_affinity":
    default:
      return narrateTopDwell(productName, english);
  }
}

/** Template narration for resolved offer — 0 LLM tokens (ADR-038 GMM-10). */
export function narrateOffer(input: NarrateOfferInput): string | null {
  const english = isEnglish(input.language);
  const { offer } = input;

  if (
    input.preferKitchenAlternative !== false &&
    offer.primary?.isKitchenBlocked &&
    offer.alternative
  ) {
    return narrateKitchenAlternative({
      primaryName: productLabel(offer.primary),
      alternativeName: productLabel(offer.alternative),
      english,
    });
  }

  const target =
    offer.trace.strategy === "cart_recovery_first" && offer.cartRecovery
      ? offer.cartRecovery
      : offer.primary;

  if (!target) return null;

  return narrateByResolution(target.resolution, productLabel(target), english);
}

/** Cart recovery uses dedicated kind + copy. */
export function narrateCartRecoveryOffer(input: {
  offer: GuestOfferContext;
  language?: string | null;
}): string | null {
  const recovery = input.offer.cartRecovery ?? input.offer.primary;
  if (!recovery || recovery.resolution !== "cart_recovery") return null;
  return narrateCartRecovery(productLabel(recovery), isEnglish(input.language));
}
