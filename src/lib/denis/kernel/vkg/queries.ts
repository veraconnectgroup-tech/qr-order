import type {
  VenueKnowledgeGraph,
  VkgPairingSuggestion,
  VkgProductExplain,
  VkgSubstituteSuggestion,
} from "@/lib/denis/kernel/vkg/types";

function normalizeAllergen(value: string): string {
  return value.trim().toLowerCase();
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

/** L1 pairing query — deterministic, no LLM (ADR-004 §5.2). */
export function pairingFor(
  graph: VenueKnowledgeGraph,
  cartProductIds: string[],
  options?: { limit?: number; excludeProductIds?: string[] }
): VkgPairingSuggestion[] {
  const limit = options?.limit ?? 3;
  const cartSet = new Set(cartProductIds);
  const exclude = new Set(options?.excludeProductIds ?? []);
  const cartCategories = productCategoryIds(graph, cartProductIds);

  if (cartSet.size === 0) return [];

  const ranked: VkgPairingSuggestion[] = [];
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
    ranked.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      menuSection: product.menuSection,
      weight: edge.weight,
      reason: edge.reason,
      ruleId: edge.ruleId,
    });

    if (ranked.length >= limit) break;
  }

  return ranked;
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
