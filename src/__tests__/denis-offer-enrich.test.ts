import { describe, expect, it } from "vitest";
import { narrateOffer } from "@/lib/denis/cognition/offer/narrate-offer";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { enrichProactiveCandidates } from "@/lib/denis/cognition/proactive/enrich-proactive-candidate";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";

function offerWithPrimary(
  partial: Partial<GuestOfferContext> & {
    productName: string;
    resolution?: GuestOfferContext["primary"] extends infer P
      ? P extends { resolution: infer R }
        ? R
        : never
      : never;
  }
): GuestOfferContext {
  const base = emptyGuestOfferContext(Date.now());
  return {
    ...base,
    readiness: { ready: true, reason: "browse_pause", secondsSinceLastBrowseAction: 10 },
    primary: {
      productId: "11111111-1111-4111-8111-111111111111",
      productName: partial.productName,
      categoryId: null,
      resolution: partial.resolution ?? "top_dwell",
      score: 0.9,
      dedupeKey: "offer:top_dwell:test",
      isKitchenBlocked: false,
    },
    trace: {
      ...base.trace,
      strategy: "exploring_top_dwell",
    },
    ...partial,
  };
}

describe("narrateOffer", () => {
  it("personalizes top dwell in Serbian", () => {
    const message = narrateOffer({
      offer: offerWithPrimary({ productName: "Beef Burger" }),
      language: "sr",
    });
    expect(message).toContain("Beef Burger");
    expect(message).toContain("Hoćete da dodam");
  });

  it("uses kitchen alternative copy when primary is blocked", () => {
    const offer = offerWithPrimary({ productName: "Beef Burger" });
    offer.primary!.isKitchenBlocked = true;
    offer.alternative = {
      productId: "22222222-2222-4222-8222-222222222222",
      productName: "Chicken Wrap",
      categoryId: null,
      resolution: "kitchen_alternative",
      score: 0.7,
      dedupeKey: "offer:kitchen_alternative:wrap",
      isKitchenBlocked: false,
    };

    const message = narrateOffer({ offer, language: "sr" });
    expect(message).toContain("Beef Burger");
    expect(message).toContain("Chicken Wrap");
  });
});

describe("enrichProactiveCandidates", () => {
  it("drops generic browse nudge when offer enrich enabled but offer unresolved", () => {
    const ranked = enrichProactiveCandidates({
      ranked: [
        {
          nudge: { kind: "browse_nudge", message: "Treba vam pomoć pri biranju?" },
          priority: 500,
          source: "browse",
        },
      ],
      offer: emptyGuestOfferContext(),
      language: "sr",
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        proactive: {
          ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
          offerEnrich: true,
        },
      },
    });

    expect(ranked).toHaveLength(0);
  });

  it("replaces browse message when offer is ready", () => {
    const ranked = enrichProactiveCandidates({
      ranked: [
        {
          nudge: { kind: "browse_nudge", message: "Treba vam pomoć pri biranju?" },
          priority: 500,
          source: "browse",
        },
      ],
      offer: offerWithPrimary({ productName: "Truffle Pasta" }),
      language: "sr",
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        proactive: {
          ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
          offerEnrich: true,
        },
      },
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.nudge.message).toContain("Truffle Pasta");
    expect(ranked[0]!.nudge.message).not.toContain("Treba vam pomoć");
  });

  it("promotes cart recovery kind when offer strategy matches", () => {
    const base = offerWithPrimary({ productName: "Pilsner" });
    const offer: GuestOfferContext = {
      ...base,
      trace: { ...base.trace, strategy: "cart_recovery_first" },
      cartRecovery: {
        productId: "22222222-2222-4222-8222-222222222222",
        productName: "Pilsner",
        categoryId: null,
        resolution: "cart_recovery",
        score: 0.85,
        dedupeKey: "offer:cart_recovery:pilsner",
        isKitchenBlocked: false,
      },
      primary: null,
      readiness: { ready: true, reason: "cart_hesitation", secondsSinceLastBrowseAction: 12 },
    };

    const ranked = enrichProactiveCandidates({
      ranked: [
        {
          nudge: { kind: "browse_nudge", message: "Generic" },
          priority: 500,
          source: "browse",
        },
      ],
      offer,
      language: "sr",
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        proactive: {
          ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
          offerEnrich: true,
        },
      },
    });

    expect(ranked[0]!.nudge.kind).toBe("cart_recovery");
    expect(ranked[0]!.nudge.message).toContain("Pilsner");
    expect(ranked[0]!.nudge.message).toContain("uklonili");
  });

  it("passes through unchanged when offerEnrich disabled", () => {
    const generic = { kind: "browse_nudge" as const, message: "Generic" };
    const ranked = enrichProactiveCandidates({
      ranked: [{ nudge: generic, priority: 500, source: "browse" }],
      offer: emptyGuestOfferContext(),
      language: "sr",
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });

    expect(ranked[0]!.nudge).toEqual(generic);
  });
});
