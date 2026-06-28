import { describe, expect, it } from "vitest";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import {
  buildPersonalizationStrip,
  MIN_TRENDING_ORDERS_TODAY,
  personalizeMenu,
  personalizationBoostLabel,
  reorderCategoriesByPersonalization,
} from "@/lib/denis/intelligence/menu-personalization";
import { toMenuGuestMemoryProjection } from "@/lib/denis/learning/guest-memory/types";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

describe("personalizeMenu", () => {
  it("pins favorite Burger on top and hides Nutella pancake for nut allergy guest", () => {
    const nowMs = Date.UTC(2026, 5, 15);
    const menu = [
      {
        id: "cat-main",
        name: "Glavna jela",
        products: [
          {
            id: "prod-pancake",
            name: "Nutella palačinka",
            price: 8,
            allergens: ["nuts"],
            created_at: new Date(nowMs - 30 * 86_400_000).toISOString(),
            sort_order: 1,
          },
          {
            id: "prod-burger",
            name: "Burger",
            price: 14,
            allergens: null,
            created_at: new Date(nowMs - 60 * 86_400_000).toISOString(),
            sort_order: 2,
          },
        ],
      },
    ];

    const guestMemory = toMenuGuestMemoryProjection(
      emptyGuestMemoryProjection({
        visitCount: 4,
        favoriteProductIds: ["prod-burger"],
        lastVisitItemNames: ["Burger"],
        favoriteItems: ["Burger"],
      })
    );

    const { sections, meta } = personalizeMenu({
      fullMenu: menu,
      guestMemory,
      guestAllergens: ["nuts"],
      browseProfile: emptyBrowseProfile(),
      priceAffinity: "mid",
      trendingProductIds: [],
      productOrderCounts: { "prod-burger": 4 },
      nowMs,
    });

    const items = sections[0]?.items ?? [];
    expect(items[0]?.productId).toBe("prod-burger");
    expect(items[0]?.boost).toBe("favorite");
    expect(items.find((item) => item.productId === "prod-pancake")?.hidden).toBe(
      true
    );
    expect(meta.hiddenAllergenCount).toBe(1);
    expect(meta.favorites[0]?.productName).toBe("Burger");
    expect(meta.strip.some((chip) => chip.label.includes("Ponovo"))).toBe(true);
  });

  it("assigns trending badge only when daily orders meet threshold", () => {
    const { sections } = personalizeMenu({
      fullMenu: [
        {
          id: "cat-drinks",
          name: "Pića",
          products: [
            {
              id: "prod-popular",
              name: "Burger Deluxe",
              price: 16,
              allergens: null,
              created_at: new Date().toISOString(),
              sort_order: 1,
            },
          ],
        },
      ],
      guestMemory: null,
      guestAllergens: [],
      browseProfile: emptyBrowseProfile(),
      priceAffinity: "mid",
      trendingProductIds: ["prod-popular"],
      trendingOrderCountsToday: { "prod-popular": MIN_TRENDING_ORDERS_TODAY },
    });

    expect(sections[0]?.items[0]?.boost).toBe("trending");
    expect(personalizationBoostLabel("trending", "sr")).toContain("Popularno danas");
  });

  it("marks products added in the last 7 days as new", () => {
    const nowMs = Date.UTC(2026, 5, 15);
    const { sections } = personalizeMenu({
      fullMenu: [
        {
          id: "cat-main",
          name: "Glavna",
          products: [
            {
              id: "prod-new",
              name: "Seasonal Bowl",
              price: 12,
              allergens: null,
              created_at: new Date(nowMs - 2 * 86_400_000).toISOString(),
              sort_order: 1,
            },
          ],
        },
      ],
      guestMemory: null,
      guestAllergens: [],
      browseProfile: emptyBrowseProfile(),
      priceAffinity: "mid",
      trendingProductIds: [],
      nowMs,
    });

    expect(sections[0]?.items[0]?.boost).toBe("new");
    expect(personalizationBoostLabel("new", "sr")).toContain("Novo");
  });

  it("sorts budget guests with cheaper items first within category", () => {
    const { sections } = personalizeMenu({
      fullMenu: [
        {
          id: "cat-food",
          name: "Hrana",
          products: [
            {
              id: "prod-premium",
              name: "Steak",
              price: 28,
              allergens: null,
              created_at: new Date().toISOString(),
              sort_order: 1,
            },
            {
              id: "prod-budget",
              name: "Supa",
              price: 6,
              allergens: null,
              created_at: new Date().toISOString(),
              sort_order: 2,
            },
          ],
        },
      ],
      guestMemory: null,
      guestAllergens: [],
      browseProfile: emptyBrowseProfile(),
      priceAffinity: "budget",
      trendingProductIds: [],
    });

    expect(sections[0]?.items.map((item) => item.productId)).toEqual([
      "prod-budget",
      "prod-premium",
    ]);
  });

  it("assigns recommended boost from VKG pairing hint", () => {
    const { sections } = personalizeMenu({
      fullMenu: [
        {
          id: "cat-main",
          name: "Glavna",
          products: [
            {
              id: "prod-beer",
              name: "Pilsner",
              price: 5,
              allergens: null,
              created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
              sort_order: 1,
            },
          ],
        },
      ],
      guestMemory: toMenuGuestMemoryProjection(
        emptyGuestMemoryProjection({
          visitCount: 3,
          lastVisitItemNames: ["Schnitzel"],
          favoriteItems: ["Schnitzel"],
        })
      ),
      guestAllergens: [],
      browseProfile: emptyBrowseProfile(),
      priceAffinity: "mid",
      trendingProductIds: [],
      vkgPairings: [
        {
          productId: "prod-beer",
          productName: "Pilsner",
          anchorProductName: "Schnitzel",
        },
      ],
    });

    expect(sections[0]?.items[0]?.boost).toBe("recommended");
    expect(sections[0]?.items[0]?.recommendedLabel).toContain("Schnitzel");
  });
});

describe("buildPersonalizationStrip", () => {
  it("builds returning guest and trending chips", () => {
    const strip = buildPersonalizationStrip(
      {
        favorites: [{ productId: "s1", productName: "Schnitzel", detail: "" }],
        trending: [{ productId: "b1", productName: "Burger", detail: "" }],
        newest: [],
      },
      "sr"
    );

    expect(strip[0]?.label).toBe("Ponovo vaš Schnitzel?");
    expect(strip[1]?.label).toContain("Danas popularan Burger");
  });
});

describe("reorderCategoriesByPersonalization", () => {
  it("filters hidden allergen products unless show all is enabled", () => {
    const categories = [
      {
        id: "cat-main",
        name: "Glavna",
        products: [
          { id: "prod-burger", name: "Burger" },
          { id: "prod-pancake", name: "Nutella palačinka" },
        ],
      },
    ];

    const { sections } = personalizeMenu({
      fullMenu: [
        {
          id: "cat-main",
          name: "Glavna",
          products: [
            {
              id: "prod-burger",
              name: "Burger",
              price: 14,
              allergens: null,
              created_at: new Date().toISOString(),
              sort_order: 1,
            },
            {
              id: "prod-pancake",
              name: "Nutella palačinka",
              price: 8,
              allergens: ["nuts"],
              created_at: new Date().toISOString(),
              sort_order: 2,
            },
          ],
        },
      ],
      guestMemory: toMenuGuestMemoryProjection(
        emptyGuestMemoryProjection({
          visitCount: 3,
          favoriteProductIds: ["prod-burger"],
        })
      ),
      guestAllergens: ["nuts"],
      browseProfile: emptyBrowseProfile(),
      priceAffinity: "mid",
      trendingProductIds: [],
    });

    const filtered = reorderCategoriesByPersonalization(categories, sections);
    expect(filtered[0]?.products.map((product) => product.id)).toEqual([
      "prod-burger",
    ]);

    const showAll = reorderCategoriesByPersonalization(categories, sections, {
      showHiddenAllergens: true,
    });
    expect(showAll[0]?.products.map((product) => product.id)).toEqual([
      "prod-burger",
      "prod-pancake",
    ]);
  });
});
