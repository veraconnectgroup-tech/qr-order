import type {
  VenueKnowledgeGraph,
  VkgPairingSuggestion,
  VkgProductExplain,
  VkgSubstituteSuggestion,
  VkgUnavailableSubstitute,
} from "@/lib/denis/kernel/vkg/types";
import type { LearnedPairing } from "@/lib/denis/intelligence/dynamic-vkg";
import {
  formatLearnedPairingGuestPrompt,
  meetsLearnedPairingSuggestionThreshold,
} from "@/lib/denis/intelligence/dynamic-vkg";

function normalizeAllergen(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeProductToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isProductUnavailable(
  graph: VenueKnowledgeGraph,
  productId: string,
  unavailableProductIds?: string[]
): boolean {
  const product = graph.products[productId];
  if (!product) return true;
  if (!product.isAvailable) return true;
  return (unavailableProductIds ?? []).includes(productId);
}

function productCategoryIds(
  graph: VenueKnowledgeGraph,
  cartProductIds: string[]
): Set<string> {
  const ids = new Set<string>();
  for (const productId of cartProductIds) {
    const catId = graph.products[productId]?.categoryId;
    if (catId) ids.add(catId);
  }
  return ids;
}

function edgeMatchesCart(
  graph: VenueKnowledgeGraph,
  edge: VenueKnowledgeGraph["edges"][number],
  cartProductIds: Set<string>,
  cartCategoryIds: Set<string>
): boolean {
  if (edge.type !== "pairs_with") return false;
  if (edge.fromKind === "product") {
    return cartProductIds.has(edge.fromId);
  }
  return cartCategoryIds.has(edge.fromId);
}

function mergePairingSuggestions(
  ranked: VkgPairingSuggestion[],
  limit: number
): VkgPairingSuggestion[] {
  const byProduct = new Map<string, VkgPairingSuggestion>();

  for (const suggestion of ranked) {
    const existing = byProduct.get(suggestion.productId);
    if (!existing || suggestion.weight > existing.weight) {
      byProduct.set(suggestion.productId, suggestion);
    }
  }

  return [...byProduct.values()]
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function pairingFromLearned(
  graph: VenueKnowledgeGraph,
  cartProductIds: string[],
  learnedPairings: LearnedPairing[],
  options?: { limit?: number; excludeProductIds?: string[] }
): VkgPairingSuggestion[] {
  const cartSet = new Set(cartProductIds);
  const exclude = new Set(options?.excludeProductIds ?? []);
  const suggestions: VkgPairingSuggestion[] = [];

  for (const pairing of learnedPairings) {
    if (!meetsLearnedPairingSuggestionThreshold(pairing)) continue;

    const candidates: Array<{ anchorId: string; suggestId: string }> = [];
    if (cartSet.has(pairing.productA) && !cartSet.has(pairing.productB)) {
      candidates.push({ anchorId: pairing.productA, suggestId: pairing.productB });
    }
    if (cartSet.has(pairing.productB) && !cartSet.has(pairing.productA)) {
      candidates.push({ anchorId: pairing.productB, suggestId: pairing.productA });
    }

    for (const candidate of candidates) {
      if (exclude.has(candidate.suggestId)) continue;

      const product = graph.products[candidate.suggestId];
      const anchor = graph.products[candidate.anchorId];
      if (!product?.isAvailable || !anchor) continue;

      suggestions.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        menuSection: product.menuSection,
        weight: Math.min(1, pairing.lift / 5),
        reason: formatLearnedPairingGuestPrompt({
          anchorName: anchor.name,
          suggestName: product.name,
        }),
        ruleId: null,
        source: "learned",
        stats: {
          confidence: pairing.confidence,
          lift: pairing.lift,
          support: pairing.support,
          coOrderCount: pairing.coOrderCount,
        },
      });
    }
  }

  return suggestions;
}

/** L1 pairing query — deterministic, no LLM (ADR-004 §5.2). */
export function pairingFor(
  graph: VenueKnowledgeGraph,
  cartProductIds: string[],
  options?: {
    limit?: number;
    excludeProductIds?: string[];
    learnedPairings?: LearnedPairing[];
  }
): VkgPairingSuggestion[] {
  const limit = options?.limit ?? 3;
  const cartSet = new Set(cartProductIds);
  const exclude = new Set(options?.excludeProductIds ?? []);
  const cartCategories = productCategoryIds(graph, cartProductIds);

  if (cartSet.size === 0) return [];

  const adminRanked: VkgPairingSuggestion[] = [];
  const seen = new Set<string>();
  const sortedEdges = [...graph.edges].sort((a, b) => b.weight - a.weight);

  for (const edge of sortedEdges) {
    if (edge.type !== "pairs_with") continue;
    if (!edgeMatchesCart(graph, edge, cartSet, cartCategories)) continue;
    if (cartSet.has(edge.toProductId) || exclude.has(edge.toProductId)) continue;
    if (seen.has(edge.toProductId)) continue;

    const product = graph.products[edge.toProductId];
    if (!product?.isAvailable) continue;

    seen.add(edge.toProductId);
    adminRanked.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      menuSection: product.menuSection,
      weight: edge.weight,
      reason: edge.reason,
      ruleId: edge.ruleId,
      source: "admin",
    });

    if (adminRanked.length >= limit) break;
  }

  const learned = pairingFromLearned(
    graph,
    cartProductIds,
    options?.learnedPairings ?? graph.learnedPairings ?? [],
    options
  );

  return mergePairingSuggestions([...learned, ...adminRanked], limit);
}

export function safeForAllergies(
  graph: VenueKnowledgeGraph,
  guestAllergens: string[],
  candidateProductIds: string[]
): string[] {
  const blocked = new Set(guestAllergens.map(normalizeAllergen).filter(Boolean));
  if (blocked.size === 0) return candidateProductIds;

  return candidateProductIds.filter((productId) => {
    const product = graph.products[productId];
    if (!product) return false;
    return !product.allergens.some((a) => blocked.has(normalizeAllergen(a)));
  });
}

export function substituteFor(
  graph: VenueKnowledgeGraph,
  productId: string,
  options?: {
    unavailableProductIds?: string[];
    limit?: number;
  }
): VkgSubstituteSuggestion[] {
  const source = graph.products[productId];
  if (!source) return [];

  const unavailable = new Set(options?.unavailableProductIds ?? [productId]);
  const limit = options?.limit ?? 3;

  const candidates = Object.values(graph.products)
    .filter(
      (p) =>
        p.isAvailable &&
        p.id !== productId &&
        !unavailable.has(p.id) &&
        p.menuSection === source.menuSection
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);

  return candidates.map((p) => ({
    productId: p.id,
    name: p.name,
    price: p.price,
    menuSection: p.menuSection,
    reason: `Same section: ${source.menuSection}`,
  }));
}

export function explainProduct(
  graph: VenueKnowledgeGraph,
  productId: string
): VkgProductExplain | null {
  const product = graph.products[productId];
  if (!product) return null;

  const pairings = pairingFor(graph, [productId], { limit: 5 });

  return {
    productId: product.id,
    name: product.name,
    price: product.price,
    menuSection: product.menuSection,
    allergens: product.allergens,
    aiDescription: product.aiDescription,
    pairings,
  };
}

/** Filter pairing suggestions by guest allergens when allergiesStrict. */
export function pairingForSafe(
  graph: VenueKnowledgeGraph,
  cartProductIds: string[],
  guestAllergens: string[],
  options?: { limit?: number }
): VkgPairingSuggestion[] {
  const raw = pairingFor(graph, cartProductIds, options);
  const safeIds = safeForAllergies(
    graph,
    guestAllergens,
    raw.map((r) => r.productId)
  );
  const safeSet = new Set(safeIds);
  return raw.filter((r) => safeSet.has(r.productId));
}

/** Match guest message tokens to menu product IDs (deterministic, no LLM). */
export function matchProductsInMessage(
  graph: VenueKnowledgeGraph,
  message: string,
  options?: { unavailableOnly?: boolean; unavailableProductIds?: string[] }
): string[] {
  const normalized = normalizeProductToken(message);
  if (!normalized) return [];

  const matched: Array<{ id: string; score: number }> = [];

  for (const product of Object.values(graph.products)) {
    const nameToken = normalizeProductToken(product.name);
    if (nameToken.length < 3) continue;

    const unavailable = isProductUnavailable(
      graph,
      product.id,
      options?.unavailableProductIds
    );
    if (options?.unavailableOnly && !unavailable) continue;

    if (normalized.includes(nameToken)) {
      matched.push({ id: product.id, score: nameToken.length });
      continue;
    }

    const firstWord = nameToken.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 4 && normalized.includes(firstWord)) {
      matched.push({ id: product.id, score: firstWord.length });
    }
  }

  return matched
    .sort((a, b) => b.score - a.score)
    .map((row) => row.id);
}

/** 86 / unavailable → same-section substitutes (ADR-004 §5.2). */
export function substitutesForUnavailable(
  graph: VenueKnowledgeGraph,
  input: {
    unavailableProductIds?: string[];
    guestMessage?: string;
    limit?: number;
  }
): VkgUnavailableSubstitute[] {
  const unavailableIds = new Set(input.unavailableProductIds ?? []);
  for (const product of Object.values(graph.products)) {
    if (!product.isAvailable) unavailableIds.add(product.id);
  }

  const sourceIds = new Set<string>();
  for (const productId of unavailableIds) {
    if (graph.products[productId]) sourceIds.add(productId);
  }

  const message = input.guestMessage?.trim() ?? "";
  if (message) {
    for (const productId of matchProductsInMessage(graph, message, {
      unavailableOnly: true,
      unavailableProductIds: [...unavailableIds],
    })) {
      sourceIds.add(productId);
    }
  }

  const results: VkgUnavailableSubstitute[] = [];
  for (const sourceProductId of sourceIds) {
    const source = graph.products[sourceProductId];
    if (!source) continue;
    const substitutes = substituteFor(graph, sourceProductId, {
      unavailableProductIds: [...unavailableIds],
      limit: input.limit ?? 2,
    });
    if (substitutes.length === 0) continue;
    results.push({
      sourceProductId,
      sourceName: source.name,
      substitutes,
    });
  }

  return results;
}

/** Top popular products → explainProduct bundle, allergy-filtered. */
export function explainPopularProducts(
  graph: VenueKnowledgeGraph,
  popularProductIds: string[],
  guestAllergens: string[],
  options?: { limit?: number }
): VkgProductExplain[] {
  const limit = options?.limit ?? 3;
  const fallbackIds = Object.values(graph.products)
    .filter((product) => product.isAvailable)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((product) => product.id);

  const rankedIds =
    popularProductIds.length > 0 ? popularProductIds : fallbackIds;
  const safeIds = safeForAllergies(graph, guestAllergens, rankedIds);

  const explains: VkgProductExplain[] = [];
  for (const productId of safeIds) {
    const explain = explainProduct(graph, productId);
    if (!explain) continue;
    explains.push(explain);
    if (explains.length >= limit) break;
  }

  return explains;
}

/** All available menu product IDs safe for guest allergens. */
export function allergySafeMenuProductIds(
  graph: VenueKnowledgeGraph,
  guestAllergens: string[],
  candidateProductIds?: string[]
): string[] {
  const candidates =
    candidateProductIds ??
    Object.values(graph.products)
      .filter((product) => product.isAvailable)
      .map((product) => product.id);
  return safeForAllergies(graph, guestAllergens, candidates);
}
