import { describe, expect, it } from "vitest";
import { buildVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/build-graph";
import {
  explainProduct,
  pairingFor,
  pairingForSafe,
  safeForAllergies,
  substituteFor,
} from "@/lib/denis/kernel/vkg/queries";

const locationId = "loc-1";

function demoGraph() {
  return buildVenueKnowledgeGraph({
    locationId,
    categories: [
      { id: "cat-drinks", name: "Drinks", menu_section: "drinks" },
      { id: "cat-food", name: "Food", menu_section: "food" },
    ],
    products: [
      {
        id: "espresso",
        name: "Espresso",
        category_id: "cat-drinks",
        price: 3.5,
        is_available: true,
        allergens: [],
        ai_description: "Strong espresso",
        menu_section: "drinks",
      },
      {
        id: "ipa",
        name: "Craft IPA",
        category_id: "cat-drinks",
        price: 5.5,
        is_available: true,
        allergens: ["gluten"],
        ai_description: null,
        menu_section: "drinks",
      },
      {
        id: "burger",
        name: "Classic Burger",
        category_id: "cat-food",
        price: 14,
        is_available: true,
        allergens: ["gluten", "milk"],
        ai_description: null,
        menu_section: "food",
      },
      {
        id: "cola",
        name: "Cola Zero",
        category_id: "cat-drinks",
        price: 4,
        is_available: true,
        allergens: [],
        ai_description: null,
        menu_section: "drinks",
      },
    ],
    upsellRules: [
      {
        id: "rule-1",
        trigger_product_id: "espresso",
        trigger_category_id: null,
        suggest_product_id: "cola",
        message: "Uz espresso ide cola",
        sort_order: 0,
      },
      {
        id: "rule-2",
        trigger_product_id: null,
        trigger_category_id: "cat-food",
        suggest_product_id: "ipa",
        message: "Uz burger ide pivo",
        sort_order: 1,
      },
    ],
  });
}

describe("VKG M5 build", () => {
  it("builds pairs_with edges from upsell rules", () => {
    const graph = demoGraph();
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0]?.type).toBe("pairs_with");
  });
});

describe("VKG M5 queries", () => {
  it("pairingFor matches product trigger", () => {
    const graph = demoGraph();
    const pairings = pairingFor(graph, ["espresso"]);
    expect(pairings).toHaveLength(1);
    expect(pairings[0]?.productId).toBe("cola");
    expect(pairings[0]?.reason).toContain("espresso");
  });

  it("pairingFor matches category trigger", () => {
    const graph = demoGraph();
    const pairings = pairingFor(graph, ["burger"]);
    expect(pairings[0]?.productId).toBe("ipa");
  });

  it("excludes cart products from pairing", () => {
    const graph = demoGraph();
    const pairings = pairingFor(graph, ["espresso", "cola"]);
    expect(pairings).toHaveLength(0);
  });

  it("safeForAllergies filters gluten", () => {
    const graph = demoGraph();
    const safe = safeForAllergies(graph, ["gluten"], ["ipa", "cola", "burger"]);
    expect(safe).toEqual(["cola"]);
  });

  it("pairingForSafe applies allergy filter", () => {
    const graph = demoGraph();
    const pairings = pairingForSafe(graph, ["burger"], ["gluten"]);
    expect(pairings).toHaveLength(0);
  });

  it("substituteFor finds same menu section", () => {
    const graph = demoGraph();
    const subs = substituteFor(graph, "espresso");
    expect(subs.some((s) => s.productId === "cola")).toBe(true);
    expect(subs.every((s) => s.menuSection === "drinks")).toBe(true);
  });

  it("explainProduct returns pairing facts bundle", () => {
    const graph = demoGraph();
    const explain = explainProduct(graph, "espresso");
    expect(explain?.name).toBe("Espresso");
    expect(explain?.pairings[0]?.productId).toBe("cola");
  });
});
