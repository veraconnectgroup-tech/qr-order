import { describe, expect, it } from "vitest";
import type { PromoCode } from "@/types";
import {
  formatPromoEvidenceBlock,
  guestAskedAboutPromo,
  isPromoCurrentlyValid,
  resolvePromoForGuest,
  shouldOfferSlowPeriodPromo,
} from "@/lib/denis/commerce/promo-intelligence";

function promo(partial: Partial<PromoCode> & Pick<PromoCode, "code">): PromoCode {
  return {
    id: "p1",
    location_id: "loc-1",
    discount_type: "percent",
    discount_value: 10,
    min_order_amount: 0,
    max_uses: null,
    used_count: 0,
    valid_from: new Date(Date.now() - 86_400_000).toISOString(),
    valid_until: null,
    is_active: true,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

describe("promo intelligence (T1)", () => {
  it("first_visit + WELCOME10 active → eligible with welcome copy", () => {
    const activePromos = [
      promo({ code: "WELCOME10", discount_type: "percent", discount_value: 10 }),
    ];

    const result = resolvePromoForGuest({
      guestMemory: { visitCount: 0, lastVisitAt: null },
      activePromos,
      cartTotal: 1200,
      venueOccupancy: 0.5,
      rhythmPriors: null,
      now: Date.now(),
      promoAlreadyOffered: false,
      guestAskedAboutPromo: false,
      isRush: false,
      firstVisit: true,
    });

    expect(result?.eligible).toBe(true);
    expect(result?.code).toBe("WELCOME10");
    expect(result?.reason).toBe("first_visit");
    expect(result?.message).toContain("WELCOME10");
    expect(result?.message).toContain("Dobrodošli");
  });

  it("30+ days away → win_back COMEBACK", () => {
    const result = resolvePromoForGuest({
      guestMemory: { visitCount: 4, lastVisitAt: daysAgoIso(31) },
      activePromos: [
        promo({ code: "COMEBACK", discount_type: "percent", discount_value: 15 }),
      ],
      cartTotal: 800,
      venueOccupancy: 0.4,
      rhythmPriors: null,
      now: Date.now(),
      promoAlreadyOffered: false,
      guestAskedAboutPromo: false,
      isRush: false,
    });

    expect(result?.code).toBe("COMEBACK");
    expect(result?.reason).toBe("win_back");
    expect(result?.message).toContain("Nedostajali ste nam");
  });

  it("does not proactively offer during rush", () => {
    const result = resolvePromoForGuest({
      guestMemory: { visitCount: 0, lastVisitAt: null },
      activePromos: [promo({ code: "WELCOME10" })],
      cartTotal: 500,
      venueOccupancy: 0.8,
      rhythmPriors: null,
      now: Date.now(),
      promoAlreadyOffered: false,
      guestAskedAboutPromo: false,
      isRush: true,
      firstVisit: true,
    });

    expect(result).toBeNull();
  });

  it("promoAlreadyOffered blocks repeat proactive offer", () => {
    const result = resolvePromoForGuest({
      guestMemory: { visitCount: 0, lastVisitAt: null },
      activePromos: [promo({ code: "WELCOME10" })],
      cartTotal: 500,
      venueOccupancy: 0.5,
      rhythmPriors: null,
      now: Date.now(),
      promoAlreadyOffered: true,
      guestAskedAboutPromo: false,
      isRush: false,
      firstVisit: true,
    });

    expect(result).toBeNull();
  });

  it("loyalty milestone at 5 visits → loyalty_reward", () => {
    const result = resolvePromoForGuest({
      guestMemory: { visitCount: 5, lastVisitAt: daysAgoIso(3) },
      activePromos: [promo({ code: "VISIT5", discount_value: 10 })],
      cartTotal: 600,
      venueOccupancy: 0.5,
      rhythmPriors: null,
      now: Date.now(),
      promoAlreadyOffered: false,
      guestAskedAboutPromo: false,
      isRush: false,
    });

    expect(result?.reason).toBe("loyalty_reward");
  });

  it("high cart > €50 → BIGORDER", () => {
    const result = resolvePromoForGuest({
      guestMemory: { visitCount: 2, lastVisitAt: daysAgoIso(2) },
      activePromos: [promo({ code: "BIGORDER", discount_value: 5 })],
      cartTotal: 5200,
      venueOccupancy: 0.5,
      rhythmPriors: null,
      now: Date.now(),
      promoAlreadyOffered: false,
      guestAskedAboutPromo: false,
      isRush: false,
    });

    expect(result?.code).toBe("BIGORDER");
    expect(result?.reason).toBe("high_cart_value");
  });

  it("answers when guest asks about discounts", () => {
    const result = resolvePromoForGuest({
      guestMemory: { visitCount: 3, lastVisitAt: null },
      activePromos: [promo({ code: "LETO2026", discount_value: 10 })],
      cartTotal: 800,
      venueOccupancy: 0.2,
      rhythmPriors: {
        currentSlotStress: "normal",
        slotSampleSessions: 20,
      },
      now: Date.now(),
      promoAlreadyOffered: false,
      guestAskedAboutPromo: true,
      isRush: false,
    });

    expect(result?.code).toBe("LETO2026");
  });

  it("skips slow_period when empty venue but rhythm expects traffic", () => {
    expect(
      shouldOfferSlowPeriodPromo({
        guestMemory: null,
        activePromos: [],
        cartTotal: 0,
        venueOccupancy: 0.2,
        rhythmPriors: {
          currentSlotStress: "normal",
          slotSampleSessions: 25,
        },
        now: Date.now(),
        promoAlreadyOffered: false,
        guestAskedAboutPromo: false,
        isRush: false,
      })
    ).toBe(false);
  });

  it("formatPromoEvidenceBlock never lists inactive codes", () => {
    const block = formatPromoEvidenceBlock({
      activePromos: [
        promo({ code: "WELCOME10", is_active: false }),
        promo({ code: "LETO2026" }),
      ],
      resolution: null,
      guestAskedAboutPromo: true,
      promoAlreadyOffered: false,
      isRush: false,
      now: Date.now(),
      cartTotal: 100,
    });

    expect(block).toContain("LETO2026");
    expect(block).not.toContain("WELCOME10");
  });

  it("guestAskedAboutPromo detects discount questions", () => {
    expect(guestAskedAboutPromo("Imate li popuste?")).toBe(true);
    expect(guestAskedAboutPromo("Dva cevapa")).toBe(false);
  });

  it("isPromoCurrentlyValid respects max uses", () => {
    expect(
      isPromoCurrentlyValid(
        promo({ code: "X", max_uses: 5, used_count: 5 }),
        Date.now(),
        100
      )
    ).toBe(false);
  });
});
