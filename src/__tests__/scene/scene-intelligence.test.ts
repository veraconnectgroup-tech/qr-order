import { describe, expect, it } from "vitest";
import { buildVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/build-graph";
import {
  deriveSceneIntelligenceBanners,
  deriveSceneIntelligenceInline,
  enrichComposeSceneInput,
} from "@/lib/scene/compose-scene";
import {
  PHASE_SCENE_CHIP_IDS,
  resolvePhaseSceneChips,
  TABLE_ACTION_CHIP_IDS,
} from "@/lib/scene/resolve-table-actions";
import type { ComposeSceneInput } from "@/lib/scene/types";

function demoGraph() {
  return buildVenueKnowledgeGraph({
    locationId: "loc-1",
    categories: [
      { id: "cat-drinks", name: "Drinks", menu_section: "drinks" },
      { id: "cat-food", name: "Food", menu_section: "food" },
    ],
    products: [
      {
        id: "burger",
        name: "Burger",
        category_id: "cat-food",
        price: 14,
        is_available: true,
        allergens: [],
        ai_description: null,
        menu_section: "food",
      },
      {
        id: "pilsner",
        name: "Pilsner",
        category_id: "cat-drinks",
        price: 5,
        is_available: true,
        allergens: ["gluten"],
        ai_description: null,
        menu_section: "drinks",
      },
    ],
    upsellRules: [
      {
        id: "rule-burger-beer",
        trigger_product_id: "burger",
        trigger_category_id: null,
        suggest_product_id: "pilsner",
        message: "Uz burger ide pivo",
        sort_order: 0,
      },
    ],
  });
}

const baseInput: ComposeSceneInput = {
  sessionId: "sess-1",
  tableName: "Sto 8",
  venueName: "Skyline Lounge",
  phase: "ordering",
  markState: "idle",
  denisActive: true,
  sheetOpen: false,
  sheetTitle: "Denis",
  thinking: false,
  blocking: null,
  banners: [],
  inlineRecommendations: [],
  chips: [],
  situation: null,
};

describe("scene intelligence Prompt 31", () => {
  it("ordering + VKG match → inline pairing banner", () => {
    const graph = demoGraph();

    const inline = deriveSceneIntelligenceInline({
      enabled: true,
      phase: "ordering",
      language: "sr",
      cartProductIds: ["burger"],
      vkgGraph: graph,
    });

    expect(inline).toHaveLength(1);
    expect(inline[0]?.productId).toBe("pilsner");
    expect(inline[0]?.name).toBe("Pilsner");

    const banners = deriveSceneIntelligenceBanners({
      enabled: true,
      phase: "ordering",
      language: "sr",
      cartProductIds: ["burger"],
      vkgGraph: graph,
    });

    expect(banners.some((banner) => banner.id === "vkg-pairing")).toBe(true);
    expect(banners[0]?.message).toContain("Burger");
    expect(banners[0]?.message).toContain("Pilsner");
    expect(banners[0]?.action).toBe("add_product");
  });

  it("settling phase → bill chips", () => {
    const chips = resolvePhaseSceneChips({
      phase: "settling",
      language: "sr",
      hasUnpaidOrders: true,
    });

    expect(chips.map((chip) => chip.label)).toEqual([
      "Plati karticom",
      "Podeli račun",
      "Ostavi napojnicu",
    ]);
    expect(chips[0]?.id).toBe("pay-online");
    expect(chips[1]?.id).toBe(PHASE_SCENE_CHIP_IDS.splitBill);
    expect(chips[2]?.id).toBe(PHASE_SCENE_CHIP_IDS.leaveTip);
  });

  it("waiting phase chips include order status and bill", () => {
    const chips = resolvePhaseSceneChips({
      phase: "waiting",
      language: "sr",
      hasUnpaidOrders: true,
    });

    expect(chips.some((chip) => chip.id === TABLE_ACTION_CHIP_IDS.viewBill)).toBe(
      true
    );
    expect(chips.some((chip) => chip.label.includes("narudžbina"))).toBe(true);
  });

  it("enrichComposeSceneInput merges intelligence when enabled", () => {
    const enriched = enrichComposeSceneInput(
      { ...baseInput, phase: "settling" },
      {
        enabled: true,
        phase: "settling",
        language: "sr",
        cartProductIds: [],
        hasUnpaidOrders: true,
      }
    );

    expect(enriched.chips.length).toBe(3);
    expect(enriched.banners.some((banner) => banner.id === "settling-ready")).toBe(
      true
    );
  });
});
