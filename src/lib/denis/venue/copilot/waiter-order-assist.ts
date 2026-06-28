import { searchCatalogProducts } from "@/lib/ai/catalog/catalog-search";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import {
  catalogToAllergyGuardProducts,
  checkAllergyConflict,
  mergeAllergieLabelSets,
  parseAllergenExclusionsFromText,
  resolveKnownAllergenIds,
} from "@/lib/denis/kernel/safety/allergy-guard";
import { pairingFor } from "@/lib/denis/kernel/vkg/queries";
import type { VenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/types";
import type {
  WaiterOrderAssistResult,
  WaiterOrderAssistSuggestion,
} from "@/lib/denis/venue/copilot/waiter-copilot-types";

function productSuggestion(product: AiCatalogProduct): WaiterOrderAssistSuggestion {
  return {
    kind: "product",
    label: product.name,
    detail: product.price != null ? `${product.price.toFixed(2)}€` : null,
    productId: product.id,
    severity: null,
  };
}

function pairingSuggestion(input: {
  name: string;
  reason?: string | null;
  productId: string;
}): WaiterOrderAssistSuggestion {
  return {
    kind: "pairing",
    label: input.name,
    detail: input.reason?.trim() || "VKG pairing",
    productId: input.productId,
    severity: "info",
  };
}

/** Deterministic waiter order assist — autocomplete, allergy, VKG pairing. */
export function buildWaiterOrderAssist(input: {
  query: string;
  catalog: AiCatalogProduct[];
  graph: VenueKnowledgeGraph | null;
  cartProductIds: string[];
  knownAllergyLabels?: string[];
  language?: string;
  limit?: number;
}): WaiterOrderAssistResult {
  const limit = input.limit ?? 5;
  const query = input.query.trim();
  const detectedAllergies = parseAllergenExclusionsFromText(query);
  const allergyLabels = mergeAllergieLabelSets(
    input.knownAllergyLabels ?? [],
    detectedAllergies
  );
  const knownAllergens = resolveKnownAllergenIds(allergyLabels);

  const matches =
    query.length >= 2
      ? searchCatalogProducts(
          Object.fromEntries(input.catalog.map((product) => [product.id, product])),
          query,
          limit
        )
          .map(productSuggestion)
      : [];

  const allergyWarnings: WaiterOrderAssistSuggestion[] = [];
  if (matches.length > 0 && knownAllergens.length > 0) {
    const guard = checkAllergyConflict({
      cartItems: matches.map((match) => ({
        productId: match.productId ?? "",
        productName: match.label,
        quantity: 1,
        serveSize: null,
        modifierIds: [],
        notes: "",
        lineTotal: 0,
        menuSection: null,
      })),
      knownAllergens,
      products: catalogToAllergyGuardProducts(
        Object.fromEntries(input.catalog.map((product) => [product.id, product]))
      ),
      language: input.language ?? "sr",
    });

    for (const conflict of guard.conflicts) {
      allergyWarnings.push({
        kind: "allergy_warning",
        label: conflict.productName,
        detail: `${conflict.allergen} — ${conflict.severity}`,
        productId: conflict.productId,
        severity: conflict.severity === "block" ? "block" : "warn",
      });
    }
  }

  const pairings: WaiterOrderAssistSuggestion[] = [];
  if (input.graph && input.cartProductIds.length > 0) {
    const suggestions = pairingFor(input.graph, input.cartProductIds, { limit: 3 });
    for (const pairing of suggestions) {
      pairings.push(
        pairingSuggestion({
          name: pairing.name,
          reason: pairing.reason,
          productId: pairing.productId,
        })
      );
    }
  }

  return { matches, pairings, allergyWarnings };
}
