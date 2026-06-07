import { AI_CONFIG } from "@/lib/ai/config";
import { searchCatalogProducts } from "@/lib/ai/catalog/catalog-search";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import {
  isProductHiddenByAllergenFilter,
  normalizeAllergenId,
  type AllergenId,
} from "@/lib/allergens";
import { rankMenuRagProductsByEmbedding } from "@/lib/denis/cognition/context/menu-rag-embeddings";
import type {
  MenuRagCatalog,
  MenuRagEvidence,
  MenuRagGateInput,
  MenuRagRetrieveOptions,
} from "@/lib/denis/cognition/context/menu-rag-types";
import { MENU_RAG_MIN_CATALOG_CAPABILITY } from "@/lib/denis/cognition/context/menu-rag-types";

export {
  MENU_RAG_MIN_CATALOG_CAPABILITY,
  type MenuRagCatalog,
  type MenuRagEmbeddingIndex,
  type MenuRagEvidence,
  type MenuRagGateInput,
  type MenuRagRetrieveOptions,
} from "@/lib/denis/cognition/context/menu-rag-types";

const EXCLUSION_PREFIX =
  /\b(?:bez|without|no|ohne|sin|sans|kein(?:e|er|es)?)\s+([\p{L}\p{N}_-]+)/giu;

const COMPOUND_FREE_PATTERN =
  /\b(gluten|laktose|lactose|dairy|milch|milk|nuss|nut|soy|soja|vegan)[\s-]*(?:free|frei)\b/giu;

const STANDALONE_FREE_PATTERN = /\b(glutenfrei|laktosefrei|vegan|vegetarisch)\b/giu;

function normalizeQueryText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function allergenFromToken(raw: string): AllergenId | null {
  const token = raw.trim().toLowerCase();
  if (!token) return null;

  const direct = normalizeAllergenId(token);
  if (direct) return direct;

  const stem = token.replace(/(a|e|u|i|o)$/u, "");
  if (stem.length >= 4) {
    const stemMatch = normalizeAllergenId(stem);
    if (stemMatch) return stemMatch;
  }

  if (token.startsWith("gluten")) return "gluten";
  if (token.startsWith("laktose") || token.startsWith("lactose")) return "milk";
  if (token.startsWith("milch") || token.startsWith("mleka")) return "milk";
  if (token.startsWith("nuss") || token.startsWith("orah")) return "nuts";

  return null;
}

function collectExcludedAllergens(query: string): Set<AllergenId> {
  const excluded = new Set<AllergenId>();
  const normalized = normalizeQueryText(query);

  for (const match of normalized.matchAll(EXCLUSION_PREFIX)) {
    const allergen = allergenFromToken(match[1] ?? "");
    if (allergen) excluded.add(allergen);
  }

  for (const match of normalized.matchAll(COMPOUND_FREE_PATTERN)) {
    const allergen = allergenFromToken(match[1] ?? "");
    if (allergen) excluded.add(allergen);
  }

  for (const match of normalized.matchAll(STANDALONE_FREE_PATTERN)) {
    const allergen = allergenFromToken(match[0] ?? "");
    if (allergen) excluded.add(allergen);
  }

  return excluded;
}

function passesAllergenFilter(
  product: AiCatalogProduct,
  excluded: ReadonlySet<AllergenId>
): boolean {
  return !isProductHiddenByAllergenFilter(product.allergens, excluded);
}

function rankMenuRagProducts(
  catalog: MenuRagCatalog,
  query: string,
  excluded: ReadonlySet<AllergenId>,
  maxResults: number,
  options: MenuRagRetrieveOptions = {}
): AiCatalogProduct[] {
  const keywordMatches = searchCatalogProducts(catalog, query)
    .filter((product) => passesAllergenFilter(product, excluded))
    .slice(0, maxResults);

  const embeddingMatches =
    options.embeddings &&
    options.queryVector?.length &&
    Object.keys(options.embeddings).length > 0
      ? rankMenuRagProductsByEmbedding(
          catalog,
          query,
          options.embeddings,
          maxResults,
          options.queryVector
        ).filter((product) => passesAllergenFilter(product, excluded))
      : [];

  const primary =
    keywordMatches.length > 0 ? keywordMatches : embeddingMatches;

  if (excluded.size === 0) {
    return primary.slice(0, maxResults);
  }

  const allergenSafe = Object.values(catalog)
    .filter((product) => passesAllergenFilter(product, excluded))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (primary.length > 0) {
    const seen = new Set<string>();
    const merged: AiCatalogProduct[] = [];

    for (const product of primary) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      merged.push(product);
    }

    for (const product of allergenSafe) {
      if (merged.length >= maxResults) break;
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      merged.push(product);
    }

    return merged.slice(0, maxResults);
  }

  return allergenSafe.slice(0, maxResults);
}

function buildMenuRagSnippet(products: AiCatalogProduct[]): string {
  if (!products.length) return "";

  return products
    .map(
      (product) =>
        `[${product.id}] ${product.name} | section: ${product.menuSection}`
    )
    .join("\n");
}

/** True when manifest capability or elite override enables menu RAG. */
export function isMenuRagEnabled(input: MenuRagGateInput): boolean {
  if (input.menuRagEnabled === true) return true;
  return (input.catalogRagLevel ?? 0) >= MENU_RAG_MIN_CATALOG_CAPABILITY;
}

/**
 * Keyword + catalog-search retriever — top-k product IDs and compact snippet.
 * Price truth stays in ACL; this only narrows evidence for perceive (MR-6).
 */
export function retrieveMenuEvidence(
  query: string,
  catalog: MenuRagCatalog,
  options: MenuRagRetrieveOptions = {}
): MenuRagEvidence {
  const trimmed = query.trim();
  if (!trimmed || Object.keys(catalog).length === 0) {
    return { productIds: [], snippet: "" };
  }

  const maxResults =
    options.maxResults ?? AI_CONFIG.maxBrowseRecommendations;
  const excluded = collectExcludedAllergens(trimmed);
  const products = rankMenuRagProducts(
    catalog,
    trimmed,
    excluded,
    maxResults,
    options
  );

  return {
    productIds: products.map((product) => product.id),
    snippet: buildMenuRagSnippet(products),
  };
}
