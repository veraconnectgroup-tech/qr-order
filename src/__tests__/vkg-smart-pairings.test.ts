import { describe, expect, it } from "vitest";
import { buildTurnVkgEvidenceBlock } from "@/lib/denis/cognition/context/load-turn-vkg-pairings";
import { buildVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/build-graph";
import {
  allergySafeMenuProductIds,
  explainPopularProducts,
  pairingForSafe,
  substitutesForUnavailable,
} from "@/lib/denis/kernel/vkg/queries";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";

const locationId = "loc-smart-pairing";

function smartPairingGraph() {
  return buildVenueKnowledgeGraph({
    locationId,
    categories: [
      { id: "cat-drinks", name: "Drinks", menu_section: "drinks" },
      { id: "cat-food", name: "Food", menu_section: "food" },
    ],
    products: [
      {
        id: "schnitzel",
        name: "Schnitzel",
        category_id: "cat-food",
        price: 16,
        is_available: true,
        allergens: ["gluten", "egg"],
        ai_description: "Classic Wiener Schnitzel with lemon",
        menu_section: "food",
      },
      {
        id: "pilsner",
        name: "Pilsner",
        category_id: "cat-drinks",
        price: 4.5,
        is_available: true,
        allergens: [],
        ai_description: "Crisp Czech lager 0.5L",
        menu_section: "drinks",
      },
      {
        id: "aperol",
        name: "Aperol Spritz",
        category_id: "cat-drinks",
        price: 8,
        is_available: false,
        allergens: [],
        ai_description: "Aperol, prosecco, soda",
        menu_section: "drinks",
      },
      {
        id: "hugo",
        name: "Hugo",
        category_id: "cat-drinks",
        price: 7.5,
        is_available: true,
        allergens: [],
        ai_description: "Elderflower spritz",
        menu_section: "drinks",
      },
      {
        id: "weizen",
        name: "Weizen",
        category_id: "cat-drinks",
        price: 5,
        is_available: true,
        allergens: ["gluten"],
        ai_description: "Bavarian wheat beer",
        menu_section: "drinks",
      },
    ],
    upsellRules: [
      {
        id: "rule-schnitzel-pils",
        trigger_product_id: "schnitzel",
        trigger_category_id: null,
        suggest_product_id: "pilsner",
        message: "Uz Schnitzel ide Pilsner",
        sort_order: 0,
      },
    ],
  });
}

function emptyReflexTurn(cartProductIds: string[] = []): ReflexTurnResult {
  return {
    reflex: null,
    correction: null,
    conflict: null,
    usedT0: false,
    handoffCommand: null,
    handoffPaymentMethod: null,
    pipelineHints: {
      reflexIntent: null,
      handoffIntent: null,
      feedsPipeline: true,
    },
    plan: {
      transition: {
        fromNodeId: "collect",
        toNodeId: "collect",
        signal: "ORDER",
        skippedGuard: false,
      },
      flowNode: {
        nodeId: "collect",
        skills: [],
        narrateTemplate: null,
        guard: null,
      },
      goals: [],
      topGoal: { type: "GUEST_SEATED", priority: 10 },
      skills: [],
      primarySignal: "ORDER",
    },
    cartState: {
      ...emptyCartState(),
      draft: {
        items: cartProductIds.map((productId) => ({
          productId,
          productName: productId,
          quantity: 1,
          modifierIds: [],
          serveSize: null,
          notes: "",
          lineTotal: 10,
        })),
        cartRevision: 1,
      },
    },
  };
}

describe("VKG smart pairings — queries", () => {
  it("pairingFor suggests Pilsner after Schnitzel order", () => {
    const graph = smartPairingGraph();
    const pairings = pairingForSafe(graph, ["schnitzel"], []);
    expect(pairings).toHaveLength(1);
    expect(pairings[0]?.name).toBe("Pilsner");
    expect(pairings[0]?.reason).toContain("Schnitzel");
  });

  it("safeForAllergies filters gluten from popular explain list", () => {
    const graph = smartPairingGraph();
    const explains = explainPopularProducts(
      graph,
      ["weizen", "pilsner", "hugo"],
      ["gluten"],
      { limit: 3 }
    );
    expect(explains.some((row) => row.name === "Weizen")).toBe(false);
    expect(explains.some((row) => row.name === "Pilsner")).toBe(true);
    expect(allergySafeMenuProductIds(graph, ["gluten"])).not.toContain("weizen");
  });

  it("substituteFor suggests Hugo when Aperol is 86", () => {
    const graph = smartPairingGraph();
    const subs = substitutesForUnavailable(graph, {
      unavailableProductIds: ["aperol"],
      guestMessage: "Aperol Spritz molim",
    });
    expect(subs).toHaveLength(1);
    expect(subs[0]?.sourceName).toBe("Aperol Spritz");
    expect(subs[0]?.substitutes[0]?.name).toBe("Hugo");
  });
});

describe("VKG smart pairings — turn evidence", () => {
  it("buildTurnVkgEvidenceBlock includes pairing after Schnitzel order", () => {
    const graph = smartPairingGraph();
    const block = buildTurnVkgEvidenceBlock(graph, {
      config: CONCIERGE_PLATFORM_DEFAULTS,
      reflexTurn: emptyReflexTurn(["schnitzel"]),
      guestMessage: "Schnitzel molim",
    });

    expect(block).toContain("VKG PAIRING:");
    expect(block).toContain("Pilsner");
    expect(block).toContain("Schnitzel");
  });

  it("buildTurnVkgEvidenceBlock includes explain for vague recommend", () => {
    const graph = smartPairingGraph();
    const block = buildTurnVkgEvidenceBlock(graph, {
      config: CONCIERGE_PLATFORM_DEFAULTS,
      reflexTurn: emptyReflexTurn(),
      guestMessage: "Šta preporučujete?",
      popularProductIds: ["schnitzel", "pilsner", "hugo"],
    });

    expect(block).toContain("VKG RECOMMEND");
    expect(block).toContain("Schnitzel");
    expect(block).toContain("Pilsner");
  });

  it("buildTurnVkgEvidenceBlock filters gluten and suggests Hugo for Aperol", () => {
    const graph = smartPairingGraph();
    const block = buildTurnVkgEvidenceBlock(graph, {
      config: CONCIERGE_PLATFORM_DEFAULTS,
      reflexTurn: emptyReflexTurn(),
      guestAllergens: ["gluten"],
      guestMessage: "Aperol Spritz molim",
      unavailableProductIds: ["aperol"],
    });

    expect(block).toContain("VKG ALLERGY SAFE");
    expect(block).not.toContain("Weizen");
    expect(block).toContain("VKG SUBSTITUTE");
    expect(block).toContain("Hugo");
    expect(block).toContain("Aperol Spritz unavailable");
  });
});

describe("buildSystemPrompt — VKG rules", () => {
  it("includes VKG usage contract in rules block", async () => {
    const { buildSystemPrompt } = await import("@/lib/ai/build-system-prompt");
    const prompt = buildSystemPrompt({
      orgName: "Test",
      menuText: "",
      language: "sr",
      allowOrdering: true,
      omitFullMenu: true,
    });

    expect(prompt).toContain("VKG PAIRING:");
    expect(prompt).toContain("VKG RECOMMEND");
    expect(prompt).toContain("VKG ALLERGY SAFE");
    expect(prompt).toContain("VKG SUBSTITUTE");
  });
});

describe("isVagueRecommendMessage", () => {
  it("detects Serbian recommendation ask", async () => {
    const { isVagueRecommendMessage } = await import(
      "@/lib/denis/cognition/tde/decide-turn-plan"
    );
    expect(isVagueRecommendMessage("Šta preporučujete?")).toBe(true);
    expect(isVagueRecommendMessage("Schnitzel molim")).toBe(false);
  });
});
