import { describe, expect, it } from "vitest";
import type { CartItem } from "@/hooks/use-cart";
import { DEBOUNCE_MS } from "@/hooks/use-denis-sense";
import { validateDenisOrderSubmit } from "@/lib/guest/apply-denis-order-submit";
import {
  buildManualCartSnapshot,
  CART_READY_IDLE_MS,
  CART_READY_MIN_ITEMS,
  deriveCartAwarenessNudge,
  manualCartRevision,
  shouldSuppressOfferForProduct,
} from "@/lib/guest/manual-cart-snapshot";
import {
  analyzeFullCartAbandon,
  DISTRACTION_DELAY_SEC,
} from "@/lib/denis/cognition/offer/smart-cart-recovery";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";

const BURGER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BEER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function burger(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: BURGER_ID,
    productName: "Beef Burger",
    unitPrice: 14,
    quantity: 1,
    notes: "",
    menuSection: "food",
    modifiers: [],
    itemTotal: 14,
    ...overrides,
  };
}

describe("Denis cart sense (Prompt 79)", () => {
  it("debounces cart sync at 600ms", () => {
    expect(DEBOUNCE_MS).toBe(600);
  });

  it("buildManualCartSnapshot captures items, quantities, and subtotal", () => {
    const items = [burger({ quantity: 2, itemTotal: 28 })];
    const snapshot = buildManualCartSnapshot(items, manualCartRevision(items, 42));

    expect(snapshot.revision).toBe(42);
    expect(snapshot.itemCount).toBe(2);
    expect(snapshot.subtotal).toBe(28);
    expect(snapshot.items[0]?.productName).toBe("Beef Burger");
    expect(snapshot.hasFood).toBe(true);
    expect(snapshot.hasDrinks).toBe(false);
  });

  it("add burger without drink → drink pairing nudge", () => {
    const snapshot = buildManualCartSnapshot([burger()], 1);
    const nudge = deriveCartAwarenessNudge({
      snapshot,
      removedProductIds: [],
      idleMs: 0,
      dismissedKeys: new Set(),
      language: "sr",
    });

    expect(nudge?.kind).toBe("drink_pairing");
    expect(nudge?.message).toMatch(/Piće uz Beef Burger/i);
  });

  it("does not re-offer removed products", () => {
    expect(shouldSuppressOfferForProduct(BURGER_ID, [BURGER_ID])).toBe(true);

    const snapshot = buildManualCartSnapshot([burger()], 1);
    const nudge = deriveCartAwarenessNudge({
      snapshot,
      removedProductIds: [BURGER_ID],
      idleMs: 0,
      dismissedKeys: new Set(),
      language: "sr",
    });

    expect(nudge).toBeNull();
  });

  it("3+ items idle 5min → ready to order nudge", () => {
    const items = [
      burger(),
      burger({ productId: BEER_ID, productName: "Cola", menuSection: "drinks", itemTotal: 4 }),
      burger({ productId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", productName: "Fries", itemTotal: 6 }),
    ];
    const snapshot = buildManualCartSnapshot(items, 3);

    const nudge = deriveCartAwarenessNudge({
      snapshot,
      removedProductIds: [],
      idleMs: CART_READY_IDLE_MS,
      dismissedKeys: new Set(),
      language: "sr",
    });

    expect(snapshot.itemCount).toBeGreaterThanOrEqual(CART_READY_MIN_ITEMS);
    expect(nudge?.kind).toBe("ready_to_order");
    expect(nudge?.message).toMatch(/Spremni za narudžbinu/i);
  });

  it("full cart abandoned 10min → distraction recovery nudge", () => {
    const plan = analyzeFullCartAbandon({
      itemCount: 3,
      subtotal: 42,
      idleMs: DISTRACTION_DELAY_SEC * 1000,
      viewedCheckout: false,
      mental: emptyGuestMentalModel(),
      language: "sr",
    });

    expect(plan.reason).toBe("distraction");
    expect(plan.action).toBe("offer_same_later");
    expect(plan.message).toMatch(/Još uvek imate/i);
  });

  it("allergy on submit → warning before kitchen", () => {
    const validation = validateDenisOrderSubmit({
      cartItems: [burger()],
      knownAllergens: ["gluten"],
      products: {
        [BURGER_ID]: {
          id: BURGER_ID,
          name: "Beef Burger",
          allergens: ["gluten"],
        },
      },
      language: "sr",
    });

    expect(validation.ok).toBe(true);
    expect(validation.warnings[0]).toMatch(/alergiju na/i);
    expect(validation.warnings[0]).toMatch(/gluten/i);
    expect(validation.warnings[0]).toMatch(/Beef Burger/i);
  });

  it("unavailable item blocks submit", () => {
    const validation = validateDenisOrderSubmit({
      cartItems: [burger()],
      knownAllergens: [],
      products: {
        [BURGER_ID]: {
          id: BURGER_ID,
          name: "Beef Burger",
          allergens: [],
        },
      },
      unavailableProductIds: new Set([BURGER_ID]),
      language: "sr",
    });

    expect(validation.ok).toBe(false);
    expect(validation.blockers[0]).toMatch(/nije dostupan/i);
  });
});
