import { describe, expect, it } from "vitest";
import { beliefGraph } from "@/lib/denis/cognition/tde";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import {
  buildMenuRagEmbeddingIndex,
  embedMenuQueryVector,
} from "@/lib/denis/cognition/context/menu-rag-embeddings";
import type { MenuRagCatalog } from "@/lib/denis/cognition/context/menu-rag-types";
import { retrieveMenuEvidence } from "@/lib/denis/cognition/context/retrievers/menu-rag";
import { resolvePlaybookPackDefinition } from "@/lib/denis/cognition/manifest/playbook-pack-registry";
import { formatPlaybookPackBlock } from "@/lib/denis/cognition/manifest/resolve-playbook-pack";
import {
  buildContextAwarenessSnapshot,
} from "@/lib/denis/intelligence/event-context";
import { buildWeatherContextFromReading } from "@/lib/denis/intelligence/weather-context";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";

function ragProduct(id: string, name: string): AiCatalogProduct {
  return {
    id,
    name,
    price: 10,
    imageUrl: null,
    menuSection: "food",
    taxRate: 19,
    allergens: [],
    modifierGroups: [],
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
  };
}

describe("Phase 2 — Denis system integrations", () => {
  it("SPOJ 2: weather context appears in situation pack", () => {
    const snapshot = buildContextAwarenessSnapshot({
      intelligence: CONCIERGE_PLATFORM_DEFAULTS.intelligence,
      language: "sr",
      weather: buildWeatherContextFromReading({
        tempC: 32,
        openWeatherMain: "Clear",
        language: "sr",
      }),
    });

    const pack = buildSituationPack({
      beliefs: beliefGraph([]),
      contextAwareness: snapshot,
    });

    expect(pack).toContain("WEATHER:");
    expect(pack).toMatch(/32|limonada|Spritz/i);
  });

  it("SPOJ 3: menu RAG returns light items for nešto lagano", async () => {
    const catalog: MenuRagCatalog = {
      salad: ragProduct("salad", "Lagana salata sa piletinom"),
      burger: ragProduct("burger", "Teški double burger"),
    };
    const bundle = await buildMenuRagEmbeddingIndex(catalog);
    const queryVector = await embedMenuQueryVector("nešto lagano", bundle.space);
    const evidence = retrieveMenuEvidence("nešto lagano", catalog, {
      embeddings: bundle.index,
      queryVector,
      maxResults: 2,
    });

    expect(evidence.productIds[0]).toBe("salad");
    expect(evidence.snippet).toContain("Lagana salata");
  });

  it("SPOJ 4: skyline playbook pack exposes signature phrases", () => {
    const pack = resolvePlaybookPackDefinition("skyline");
    expect(pack?.signaturePhrases.some((phrase) => /Dobro veče/i.test(phrase))).toBe(
      true
    );

    const block = formatPlaybookPackBlock("skyline");
    expect(block).toMatch(/Skyline Lounge|Dobro veče/i);
  });
});
