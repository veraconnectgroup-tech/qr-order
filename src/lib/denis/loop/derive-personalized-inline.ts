import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { isReturningGuest } from "@/lib/denis/loop/derive-contextual-chips";

export type PersonalizedInlineRecommendation = {
  productId: string;
  name: string;
  reason?: string;
  priceCents?: number;
};

const MAX_INLINE = 3;

function reasonForLanguage(
  language: string,
  key: "favorite" | "premium" | "special"
): string {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    if (key === "favorite") return "Ihr Favorit";
    if (key === "premium") return "Premium-Tipp";
    return "Tagesangebot";
  }
  if (lang === "en") {
    if (key === "favorite") return "Your favorite";
    if (key === "premium") return "Premium pick";
    return "Today's special";
  }
  if (key === "favorite") return "Vaš favorit";
  if (key === "premium") return "Premium izbor";
  return "Današnja ponuda";
}

function productNameFromMemory(
  memory: GuestMemoryProjection,
  productId: string,
  index: number
): string {
  const fromBrowse = memory.lastVisitItemNames[index];
  if (fromBrowse) return fromBrowse;
  return productId;
}

function pushUnique(
  out: PersonalizedInlineRecommendation[],
  seen: Set<string>,
  entry: PersonalizedInlineRecommendation
): void {
  if (seen.has(entry.productId)) return;
  seen.add(entry.productId);
  out.push(entry);
}

/** J2 — personalized inline recommendations (max 3). */
export function derivePersonalizedInline(input: {
  mental: GuestMentalModel;
  offer: GuestOfferContext;
  memory: GuestMemoryProjection | null;
  language: string;
}): PersonalizedInlineRecommendation[] {
  const out: PersonalizedInlineRecommendation[] = [];
  const seen = new Set<string>();
  const { memory, offer, mental } = input;

  if (memory && isReturningGuest(memory)) {
    for (const [index, productId] of memory.favoriteProductIds.entries()) {
      if (out.length >= MAX_INLINE) break;
      const scored = offer.scoredProducts.find(
        (product) => product.productId === productId
      );
      const name =
        scored?.productName ??
        productNameFromMemory(memory, productId, index) ??
        productId;
      pushUnique(out, seen, {
        productId,
        name,
        reason: reasonForLanguage(input.language, "favorite"),
      });
    }
  }

  if (out.length < MAX_INLINE && mental.priceAffinity === "premium") {
    for (const candidate of [
      offer.primary,
      offer.alternative,
      ...offer.scoredProducts.slice(0, 4).map((product) => ({
        productId: product.productId,
        productName: product.productName,
        categoryId: null,
        resolution: "top_dwell" as const,
        score: product.score,
        dedupeKey: product.productId,
        isKitchenBlocked: false,
      })),
    ]) {
      if (!candidate || out.length >= MAX_INLINE) break;
      pushUnique(out, seen, {
        productId: candidate.productId,
        name: candidate.productName,
        reason: reasonForLanguage(input.language, "premium"),
      });
    }
  }

  if (out.length < MAX_INLINE && mental.priceAffinity === "budget") {
    const budgetPick =
      offer.cartRecovery ??
      offer.alternative ??
      offer.scoredProducts.find((product) => product.score > 0) ??
      null;
    if (budgetPick) {
      pushUnique(out, seen, {
        productId: budgetPick.productId,
        name: budgetPick.productName,
        reason: reasonForLanguage(input.language, "special"),
      });
    }
  }

  if (out.length < MAX_INLINE && offer.primary) {
    pushUnique(out, seen, {
      productId: offer.primary.productId,
      name: offer.primary.productName,
      reason: undefined,
    });
  }

  return out.slice(0, MAX_INLINE);
}
