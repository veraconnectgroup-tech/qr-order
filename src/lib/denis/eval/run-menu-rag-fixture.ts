import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import {
  buildMenuRagEmbeddingIndex,
  embedMenuQueryVector,
} from "@/lib/denis/cognition/context/menu-rag-embeddings";
import type { MenuRagCatalog } from "@/lib/denis/cognition/context/menu-rag-types";
import { retrieveMenuEvidence } from "@/lib/denis/cognition/context/retrievers/menu-rag";

export type MenuRagFixtureResult = {
  passed: boolean;
  errors: string[];
  topProductId: string | null;
};

function product(
  id: string,
  name: string,
  allergens: string[] = []
): AiCatalogProduct {
  return {
    id,
    name,
    price: 10,
    imageUrl: null,
    menuSection: "food",
    taxRate: 19,
    allergens,
    modifierGroups: [],
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
  };
}

function lightMenuCatalog(): MenuRagCatalog {
  return {
    "food-light": product("food-light", "Lagana salata"),
    "food-heavy": product("food-heavy", "Teški burger"),
    "food-beer": product("food-beer", "Pilsner 0,3L"),
  };
}

/** E2.1 — semantic menu RAG: "nešto lagano" → light menu item. */
export async function runMenuRagLightMealFixture(): Promise<MenuRagFixtureResult> {
  const errors: string[] = [];
  const catalog = lightMenuCatalog();
  const query = "nešto lagano";

  const bundle = await buildMenuRagEmbeddingIndex(catalog);
  const queryVector = await embedMenuQueryVector(query, bundle.space);
  const evidence = retrieveMenuEvidence(query, catalog, {
    embeddings: bundle.index,
    queryVector,
    maxResults: 3,
  });

  const topProductId = evidence.productIds[0] ?? null;

  if (!topProductId) {
    errors.push("expected at least one menu RAG hit for nešto lagano");
  }

  if (topProductId !== "food-light") {
    errors.push(
      `expected food-light (Lagana salata), got ${topProductId ?? "none"}`
    );
  }

  for (const productId of evidence.productIds) {
    if (!catalog[productId]) {
      errors.push(`unknown product id in evidence: ${productId}`);
    }
  }

  if (!evidence.snippet.includes("[food-light] Lagana salata")) {
    errors.push("snippet missing Lagana salata pointer");
  }

  return {
    passed: errors.length === 0,
    errors,
    topProductId,
  };
}
