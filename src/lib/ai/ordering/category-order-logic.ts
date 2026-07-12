import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import { searchCatalogWithFuzzyOutcome } from "@/lib/ai/catalog/catalog-search";
import type { OrderSizeIntentAssessment } from "@/lib/ai/ordering/order-size-intent-types";

const GENERIC_ORDER_TOKENS = new Set([
  "pivo",
  "piva",
  "beer",
  "bier",
  "lager",
  "ale",
  "veliko",
  "velika",
  "velik",
  "malo",
  "mala",
  "small",
  "large",
  "jedno",
  "jedna",
  "jedan",
  "one",
  "dva",
  "tri",
  "two",
  "three",
  "molim",
  "please",
  "hoce",
  "hoću",
  "hocu",
  "zeleo",
  "želeo",
  "zelim",
  "želim",
  "daj",
  "give",
  "want",
  "moze",
  "može",
]);

/** Used by order-message-backfill.ts for cart-segment scoring — unrelated to order-comprehension hints, left as-is. */
export function isGenericCategorySegment(segment: string): boolean {
  const tokens = segment
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
  const meaningful = tokens.filter((t) => !GENERIC_ORDER_TOKENS.has(t));
  return meaningful.length === 0 && tokens.some((t) => GENERIC_ORDER_TOKENS.has(t));
}

export function menuKnowledgeHint(): string {
  return [
    "MENU KNOWLEDGE HINT:",
    "- Guest asks what an item is — answer warmly from MENU text (description, style, brand, e.g. wheat beer / Schneider).",
    '- intent "chat" or "menu_info"; recommendations = [] unless they ask to pick.',
    "- After explaining, one polite line to continue the order — do not reset to generic welcome.",
  ].join("\n");
}

/** Every drink-category product sharing the same size presets, sorted smallest-first. */
function unionVolumePresetsFor(products: AiCatalogProduct[]): string[] {
  const sizes = new Set<string>();
  for (const product of products) {
    for (const preset of product.serveSizePresets) sizes.add(preset);
  }
  return [...sizes].sort(
    (a, b) => parseFloat(a.replace(/[^\d.]/g, "")) - parseFloat(b.replace(/[^\d.]/g, ""))
  );
}

function namedProductHint(
  assessment: OrderSizeIntentAssessment,
  catalog: Record<string, AiCatalogProduct>
): string | null {
  if (!assessment.productNameGuess) return null;

  const outcome = searchCatalogWithFuzzyOutcome(
    catalog,
    assessment.productNameGuess,
    { maxResults: 1 }
  );
  const top = outcome.matches[0];
  if (!outcome.shouldUseDirectly || !top) return null;

  const product = catalog[top.productId];
  if (!product || !product.serveSizePresets.length) return null;
  if (assessment.sizePreference === "unspecified") return null;

  const sizeWord = assessment.sizePreference === "larger" ? "largest" : "smallest";
  const sorted = [...product.serveSizePresets].sort(
    (a, b) => parseFloat(a.replace(/[^\d.]/g, "")) - parseFloat(b.replace(/[^\d.]/g, ""))
  );
  const inferred =
    assessment.sizePreference === "larger" ? sorted[sorted.length - 1] : sorted[0];
  if (!inferred) return null;

  return [
    "ORDER COMPREHENSION HINT:",
    `- Guest named "${product.name}" and expressed a ${sizeWord === "largest" ? "bigger" : "smaller"} size preference: "${assessment.quotedSpan}"`,
    `- Size ALREADY implied: ${inferred} (the ${sizeWord} of ${sorted.join("/")}) — do NOT ask which size again, use it directly.`,
    `- proposedItems MUST include productId "${product.id}" with serveSize "${inferred}".`,
  ].join("\n");
}

/**
 * Structured drink_family (an admin-set catalog field, catalog-builder.ts)
 * is the primary signal — real category data, not a guess against product
 * NAMES. Falls back to fuzzy name search only when a venue hasn't tagged
 * drinkFamily for its products; fuzzy search only ever matches product
 * NAME text (fuzzy-match-engine.ts), so a venue with branded, un-tagged
 * beers ("Pilsner", "Weizen Schneider") and a guest asking generically
 * for "beer" would find nothing without this primary path.
 */
function findCategoryCandidates(
  categoryGuess: string,
  catalog: Record<string, AiCatalogProduct>
): AiCatalogProduct[] {
  const normalized = categoryGuess.toLowerCase().trim();

  const byFamily = Object.values(catalog).filter(
    (p) =>
      p.menuSection === "drinks" &&
      p.drinkFamily?.toLowerCase().trim() === normalized
  );
  if (byFamily.length >= 2) return byFamily;

  return searchCatalogWithFuzzyOutcome(catalog, categoryGuess, {
    maxResults: 6,
  }).matches
    .map((m) => catalog[m.productId])
    .filter((p): p is AiCatalogProduct => Boolean(p) && p.menuSection === "drinks");
}

function genericCategoryHint(
  assessment: OrderSizeIntentAssessment,
  catalog: Record<string, AiCatalogProduct>
): string | null {
  if (!assessment.genericCategoryGuess) return null;

  const candidates = findCategoryCandidates(assessment.genericCategoryGuess, catalog);

  if (candidates.length < 2) return null;

  const names = candidates.map((p) => p.name).join(" | ");

  if (assessment.sizePreference !== "unspecified") {
    const presets = unionVolumePresetsFor(candidates);
    if (presets.length > 0) {
      const inferred =
        assessment.sizePreference === "larger"
          ? presets[presets.length - 1]
          : presets[0];
      return [
        "ORDER COMPREHENSION HINT:",
        `- Guest asked for "${assessment.genericCategoryGuess}" with a size preference: "${assessment.quotedSpan}"`,
        `- Size ALREADY implied: ${inferred} — do NOT ask which size again.`,
        `- ONLY ask which product: ${names}`,
        `- When guest picks, proposedItems MUST include serveSize "${inferred}".`,
      ].join("\n");
    }
  }

  return [
    "ORDER COMPREHENSION HINT:",
    `- Guest asked for "${assessment.genericCategoryGuess}" generically, no size stated.`,
    `- Real options on this menu, exactly as named — never invent one not in this list: ${names}`,
    `- Ask which one AND what size, in ONE question — do not guess a product.`,
    `- intent "clarify" until both product and size are known; proposedItems stays empty until then.`,
  ].join("\n");
}

/**
 * Deterministic layer — turns the LLM's OWN structured perception
 * (assess-order-size-intent.ts, called upstream since this file must
 * stay synchronous/OpenAI-free) into an actual prompt hint, always
 * re-grounded against the real catalog via the same fuzzy-match
 * confidence gate (shouldUseDirectly) already trusted elsewhere in this
 * codebase. Never trusts the LLM's raw guessed name as a real productId
 * directly — that would risk hallucinated products; this only accepts a
 * match the catalog itself confidently confirms.
 *
 * Replaces a regex/keyword-list version (BEER_CATEGORY_PATTERN,
 * NAMED_BEER_PATTERN, messageImpliesServeSize's word list) removed
 * 2026-07-12 per the founder's explicit, repeated instruction: Denis
 * serves guests "from around the world" — a word list can only ever
 * cover languages/phrasings a developer thought of. See
 * order-size-intent-types.ts for the full reasoning.
 */
export function resolveOrderSizeHint(
  assessment: OrderSizeIntentAssessment | null,
  catalog: Record<string, AiCatalogProduct>
): string | null {
  if (!assessment) return null;

  if (assessment.isMenuKnowledgeQuestion) {
    return menuKnowledgeHint();
  }

  if (assessment.namesSpecificProduct) {
    return namedProductHint(assessment, catalog);
  }

  if (assessment.isGenericDrinkRequest) {
    return genericCategoryHint(assessment, catalog);
  }

  return null;
}
