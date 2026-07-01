import { describe, expect, it } from "vitest";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import {
  computeDessertNudgeDismissPatch,
  dismissedKeysIncludeDessert,
} from "@/lib/denis/platform/guest-memory-dessert-dismiss";
import {
  CONTEXTUAL_CHIP_IDS,
  deriveContextualChips,
  resolveSameAgainProductIds,
} from "@/lib/denis/loop/derive-contextual-chips";
import { derivePersonalizedInline } from "@/lib/denis/loop/derive-personalized-inline";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { CartView } from "@/lib/denis/loop/view-types";
import { TABLE_ACTION_CHIP_IDS } from "@/lib/scene/resolve-table-actions";

const emptyCart: CartView = {
  aiItemCount: 0,
  manualItemCount: 0,
  visibleItemCount: 0,
  hasConflict: false,
  conflictPrompt: null,
  revision: 0,
};

function memory(
  overrides: Partial<GuestMemoryProjection> = {}
): GuestMemoryProjection {
  return emptyGuestMemoryProjection({
    preferredLanguage: "sr",
    ...overrides,
  });
}

describe("deriveContextualChips J2", () => {
  it("shows same-again chip for returning guest with no orders", () => {
    const chips = deriveContextualChips({
      mental: emptyGuestMentalModel(),
      phase: "browsing",
      cart: emptyCart,
      memory: memory({
        visitCount: 3,
        favoriteProductIds: ["prod-burger", "prod-ipa"],
        lastVisitItemNames: ["Burger", "IPA"],
      }),
      language: "sr",
      situation: null,
      hasUnpaidOrders: false,
      orderCount: 0,
    });

    expect(chips.some((chip) => chip.id === CONTEXTUAL_CHIP_IDS.sameAgain)).toBe(
      true
    );
    expect(chips.find((chip) => chip.id === CONTEXTUAL_CHIP_IDS.sameAgain)?.label).toBe(
      "Ponovo isto"
    );
    expect(chips.length).toBeLessThanOrEqual(4);
    chips.forEach((chip) => expect(chip.label.length).toBeLessThanOrEqual(20));
  });

  it("resolves favourite product ids for same-again cart action", () => {
    expect(
      resolveSameAgainProductIds(
        memory({
          visitCount: 2,
          favoriteProductIds: ["prod-1", "prod-2"],
        })
      )
    ).toEqual(["prod-1", "prod-2"]);
  });

  it("shows waiting chips during active kitchen wait", () => {
    const chips = deriveContextualChips({
      mental: { ...emptyGuestMentalModel(), intent: "waiting_food" },
      phase: "waiting",
      cart: emptyCart,
      memory: null,
      language: "en",
      situation: {
        headline: "#42 · preparing",
        orders: [],
        hasReadyOrder: false,
        hasActiveKitchen: true,
      },
      hasUnpaidOrders: true,
      orderCount: 1,
    });

    expect(chips.map((chip) => chip.id)).toEqual([
      CONTEXTUAL_CHIP_IDS.orderStatus,
      CONTEXTUAL_CHIP_IDS.addDrinkWaiting,
      TABLE_ACTION_CHIP_IDS.viewBill,
    ]);
  });

  it("shows ordering chips when cart has items", () => {
    const chips = deriveContextualChips({
      mental: { ...emptyGuestMentalModel(), intent: "ordering" },
      phase: "ordering",
      cart: { ...emptyCart, visibleItemCount: 2 },
      memory: null,
      language: "sr",
      situation: null,
      hasUnpaidOrders: false,
      orderCount: 0,
    });

    expect(chips.map((chip) => chip.id)).toEqual([
      CONTEXTUAL_CHIP_IDS.placeOrder,
      CONTEXTUAL_CHIP_IDS.addDrink,
      CONTEXTUAL_CHIP_IDS.changeOrder,
    ]);
  });
});

describe("derivePersonalizedInline J2", () => {
  it("prioritizes returning guest favourites", () => {
    const offer = {
      ...emptyGuestOfferContext(),
      scoredProducts: [
        {
          productId: "prod-burger",
          productName: "Burger",
          categoryPath: [],
          viewCount: 1,
          totalDwellMs: 1000,
          addedToCart: false,
          removedFromCart: false,
          disposition: "viewed" as const,
          score: 10,
          lastViewedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    const inline = derivePersonalizedInline({
      mental: emptyGuestMentalModel(),
      offer,
      memory: memory({
        visitCount: 2,
        favoriteProductIds: ["prod-burger"],
        lastVisitItemNames: ["Burger"],
      }),
      language: "sr",
    });

    expect(inline).toHaveLength(1);
    expect(inline[0]?.productId).toBe("prod-burger");
    expect(inline[0]?.reason).toBe("Vaš favorit");
    expect(inline.length).toBeLessThanOrEqual(3);
  });
});

describe("dessert banner learning J2", () => {
  it("detects dessert dismiss keys", () => {
    expect(dismissedKeysIncludeDessert(["dessert_nudge"])).toBe(true);
    expect(dismissedKeysIncludeDessert(["dessert_nudge:ord-1"])).toBe(true);
    expect(dismissedKeysIncludeDessert(["browse_nudge"])).toBe(false);
  });

  it("sets skip after three dismissals", () => {
    const patch = computeDessertNudgeDismissPatch({
      memory: memory({ dessertNudgeDismissCount: 2 }),
    });
    expect(patch).toEqual({
      dessertNudgeDismissCount: 3,
      skipDessertNudge: true,
    });
  });
});
