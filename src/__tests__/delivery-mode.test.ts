import { describe, expect, it } from "vitest";
import {
  buildDenisPickupPrompt,
  buildDeliveryQuoteMessage,
  buildKdsFulfillmentLabel,
  buildPackagingSuggestions,
  buildTakeawayConfirmationMessage,
  buildTakeawayPickupSlots,
  buildTakeawayReadyNotification,
  calculateDeliveryFee,
  DEFAULT_DELIVERY_CONFIG,
  estimatePrepMinutesFromCart,
  isWithinDeliveryRadius,
  kitchenOrderModeBadge,
  resolveKitchenPrepPriority,
  splitItemsByFulfillmentMode,
  validateDeliveryOrder,
  validateTakeawayPayment,
} from "@/lib/denis/commerce/delivery-mode";
import {
  REDUCED_VAT_RATE,
  dsfinvkInhausFlag,
  resolveItemTaxRateForOrderMode,
} from "@/lib/tax/vat";

describe("delivery-mode", () => {
  it("confirms takeaway order with pickup time", () => {
    const pickupTime = new Date(Date.UTC(2026, 5, 27, 12, 0)).toISOString();
    const message = buildTakeawayConfirmationMessage({
      orderNumber: 42,
      pickupTime,
    });
    expect(message).toMatch(/Narudžba #42 primljena/);
    expect(message).toMatch(/14:00|12:00/);
  });

  it("validates takeaway when enabled", () => {
    const result = validateDeliveryOrder({
      mode: "takeaway",
      config: DEFAULT_DELIVERY_CONFIG,
      address: null,
      cartTotal: 15,
    });
    expect(result.valid).toBe(true);
    expect(result.estimatedMinutes).toBeGreaterThanOrEqual(5);
  });

  it("rejects delivery outside radius", () => {
    const result = validateDeliveryOrder({
      mode: "delivery",
      config: { ...DEFAULT_DELIVERY_CONFIG, deliveryEnabled: true },
      address: "Remote street 1",
      cartTotal: 25,
      distanceKm: 8,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("outside_delivery_radius");
  });

  it("estimates prep time from cart complexity", () => {
    const prep = estimatePrepMinutesFromCart({
      items: [
        { productId: "1", productName: "Burger", quantity: 2, menuSection: "food" },
        { productId: "2", productName: "Pomfrit", quantity: 1, menuSection: "food" },
        { productId: "3", productName: "Pivo", quantity: 2, menuSection: "drinks" },
      ],
      baseMinutes: 15,
    });
    expect(prep).toBeGreaterThanOrEqual(15);
  });

  it("requires online payment in v1", () => {
    const payment = validateTakeawayPayment({
      config: DEFAULT_DELIVERY_CONFIG,
      paymentMethod: "cash",
    });
    expect(payment.valid).toBe(false);
  });

  it("applies free delivery above threshold", () => {
    const result = validateDeliveryOrder({
      mode: "delivery",
      config: {
        ...DEFAULT_DELIVERY_CONFIG,
        deliveryEnabled: true,
        freeDeliveryAbove: 20,
      },
      address: "Bulevar Kralja Aleksandra 42",
      cartTotal: 25,
      withinRadius: true,
      distanceKm: 2,
    });
    expect(result.valid).toBe(true);
    expect(result.fee).toBe(0);
  });

  it("calculates delivery fee with per-km surcharge", () => {
    const fee = calculateDeliveryFee({
      config: DEFAULT_DELIVERY_CONFIG,
      cartTotal: 10,
      distanceKm: 4,
    });
    expect(fee).toBe(5.5);
  });

  it("prioritizes dine-in in kitchen prep order", () => {
    expect(resolveKitchenPrepPriority("dine_in")).toBeLessThan(
      resolveKitchenPrepPriority("takeaway")
    );
    expect(kitchenOrderModeBadge("takeaway")).toBe("🟡");
    expect(buildKdsFulfillmentLabel("takeaway")).toBe("TAKEAWAY");
  });

  it("builds pickup slot options and Denis prompt", () => {
    const now = Date.UTC(2026, 5, 27, 10, 0);
    const slots = buildTakeawayPickupSlots({ now, prepMinutes: 20 });
    expect(slots.length).toBeGreaterThanOrEqual(2);
    expect(slots[0]?.label).toMatch(/prije|~20/);
    expect(buildDenisPickupPrompt("sr")).toMatch(/Kad želite preuzeti/);
  });

  it("suggests packaging for soup items", () => {
    const suggestions = buildPackagingSuggestions([
      { productId: "1", productName: "Domaca supa", quantity: 1, menuSection: "food" },
    ]);
    expect(suggestions[0]?.suggestion).toBe("Sealed container");
  });

  it("detects mixed fulfillment cart", () => {
    const split = splitItemsByFulfillmentMode({
      defaultMode: "dine_in",
      items: [
        { productId: "1", productName: "Pivo", quantity: 1 },
        { productId: "2", productName: "Burger", quantity: 1, fulfillmentMode: "takeaway" },
      ],
    });
    expect(split.isMixed).toBe(true);
    expect(split.offPremise).toHaveLength(1);
    expect(split.dineIn).toHaveLength(1);
  });

  it("builds delivery quote message", () => {
    const message = buildDeliveryQuoteMessage({
      address: "Test 1",
      fee: 3.5,
      estimatedMinutes: 25,
    });
    expect(message).toMatch(/€3\.50/);
    expect(message).toMatch(/~25 min/);
  });

  it("builds ready notification channels", () => {
    const notification = buildTakeawayReadyNotification({
      orderNumber: 12,
      mode: "takeaway",
      guestEmail: "guest@example.com",
      pushAvailable: true,
    });
    expect(notification.channels).toContain("push");
    expect(notification.channels).toContain("email");
  });
});

describe("takeaway VAT", () => {
  it("applies 7% VAT for takeaway food", () => {
    expect(
      resolveItemTaxRateForOrderMode({
        productTaxRate: REDUCED_VAT_RATE,
        menuSection: "food",
        orderMode: "takeaway",
      })
    ).toBe(7);
  });

  it("maps takeaway to DSFinV-K INHAUS=0", () => {
    expect(dsfinvkInhausFlag("takeaway")).toBe("0");
    expect(dsfinvkInhausFlag("dine_in")).toBe("1");
  });
});

describe("delivery radius", () => {
  it("accepts addresses within radius", () => {
    expect(isWithinDeliveryRadius({ distanceKm: 4.5, radiusKm: 5 })).toBe(true);
    expect(isWithinDeliveryRadius({ distanceKm: 6, radiusKm: 5 })).toBe(false);
  });
});
