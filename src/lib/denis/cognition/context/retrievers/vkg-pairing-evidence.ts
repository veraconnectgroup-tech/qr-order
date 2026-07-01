import type {
  VkgPairingSuggestion,
  VkgProductExplain,
  VkgUnavailableSubstitute,
} from "@/lib/denis/kernel/vkg/types";
import type { BasketPair } from "@/lib/denis/config/basket-pair-types";
import { pickLearnedPairForCart } from "@/lib/denis/config/basket-pair-analysis";

/** VKG pairing hints for LLM perceive — facts only, no invented products. */
export function retrieveVkgPairingEvidence(
  pairings: VkgPairingSuggestion[]
): string | null {
  if (pairings.length === 0) return null;

  const lines = pairings.map((pairing) => {
    const reason = pairing.reason?.trim();
    const stats =
      pairing.source === "learned" && pairing.stats
        ? ` (${Math.round(pairing.stats.confidence * 100)}% conf, lift ${pairing.stats.lift.toFixed(1)})`
        : "";
    return reason
      ? `- ${pairing.name} — ${reason}${stats}`
      : `- ${pairing.name}${stats}`;
  });

  return [
    "VKG PAIRING:",
    "- Verified menu suggestions — suggest naturally when guest orders food/drink.",
    "- Learned pairs: use the guest line verbatim when source is basket history.",
    ...lines,
    "- Offer at most one pairing as a short question; use exact product names.",
  ].join("\n");
}

function formatPrice(price: number): string {
  return `${price.toFixed(2).replace(/\.00$/, "")}€`;
}

/** VKG explainProduct facts for vague recommend / menu browse. */
export function retrieveVkgExplainEvidence(
  explains: VkgProductExplain[]
): string | null {
  if (explains.length === 0) return null;

  const lines = explains.map((item) => {
    const description = item.aiDescription?.trim();
    const allergenNote =
      item.allergens.length > 0
        ? ` (allergens: ${item.allergens.join(", ")})`
        : "";
    const pairingNote =
      item.pairings[0]?.name != null
        ? `; pairs with ${item.pairings[0].name}`
        : "";
    const detail = description ? ` — ${description}` : "";
    return `- ${item.name} ${formatPrice(item.price)}${allergenNote}${detail}${pairingNote}`;
  });

  return [
    "VKG RECOMMEND (popular — explain from facts only):",
    ...lines,
    "- Use intent \"recommend\" with these productIds; max 3 items with prices.",
  ].join("\n");
}

/** VKG substituteFor when item is 86 / unavailable. */
export function retrieveVkgSubstituteEvidence(
  substitutes: VkgUnavailableSubstitute[]
): string | null {
  if (substitutes.length === 0) return null;

  const lines = substitutes.flatMap((row) => {
    const alt = row.substitutes[0];
    if (!alt) return [];
    return [
      `- ${row.sourceName} unavailable → suggest ${alt.name} (${formatPrice(alt.price)})`,
    ];
  });

  if (lines.length === 0) return null;

  return [
    "VKG SUBSTITUTE (86 list — facts only):",
    ...lines,
    "- Never promise unavailable items; offer substitute warmly in one short line.",
  ].join("\n");
}

/** Allergy-safe menu filter for recommend/order turns. */
export function retrieveVkgAllergyEvidence(input: {
  guestAllergens: string[];
  safeProductNames: string[];
}): string | null {
  const allergens = input.guestAllergens.map((value) => value.trim()).filter(Boolean);
  if (allergens.length === 0) return null;

  const safePreview =
    input.safeProductNames.length > 0
      ? input.safeProductNames.slice(0, 8).join(", ")
      : "none matched — ask staff";

  return [
    "VKG ALLERGY SAFE:",
    `- Guest allergens: ${allergens.join(", ")}`,
    `- Safe menu items include: ${safePreview}`,
    "- Recommend/order ONLY from allergy-safe items; exclude uncertain dishes.",
  ].join("\n");
}

/** Merge VKG evidence blocks for Situation Pack. */
export function retrieveCombinedVkgEvidence(
  blocks: Array<string | null | undefined>
): string | null {
  const merged = blocks.map((block) => block?.trim()).filter(Boolean) as string[];
  return merged.length > 0 ? merged.join("\n\n") : null;
}

export function retrieveCombinedPairingEvidence(input:
  | VkgPairingSuggestion[]
  | {
      manual?: VkgPairingSuggestion[];
      learned?: BasketPair[];
      cartProductIds?: string[];
    }
): string | null {
  if (Array.isArray(input)) return retrieveVkgPairingEvidence(input);

  const blocks: string[] = [];
  const manual = retrieveVkgPairingEvidence(input.manual ?? []);
  if (manual) blocks.push(`${manual}\n(source: manual)`);

  const learned = pickLearnedPairForCart(
    input.learned ?? [],
    input.cartProductIds ?? []
  );
  if (learned) {
    blocks.push(
      [
        "LEARNED PAIRING (basket history):",
        `- ${learned.productBName} with ${learned.productAName} (${learned.confidencePercent}% confidence, ${learned.sampleSessions} sessions)`,
        "- Offer only if it fits the guest's current cart.",
        "(source: learned)",
      ].join("\n")
    );
  }

  return blocks.length > 0 ? blocks.join("\n\n") : null;
}
