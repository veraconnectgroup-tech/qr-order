import { describe, expect, it } from "vitest";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import type { CommercePolicy } from "@/lib/commerce/policy/commerce-policy.schema";
import { isCommerceCapabilityActive } from "@/lib/commerce/policy/resolve-commerce-capability";
import { buildSmartTipOffer } from "@/lib/denis/commerce/build-smart-tip-offer";
import {
  aggregateTipAnalytics,
  buildSettlingTipDenisMessage,
  formatStaffTipCelebrationLine,
  resolveTipMarketRegion,
  resolveTipSuggestion,
  tipAmountFromPercent,
} from "@/lib/denis/commerce/smart-tips";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

describe("resolveTipSuggestion P37", () => {
  it("score=9 → default 15% with presets 10/15/20", () => {
    const result = resolveTipSuggestion({
      orderTotal: 100,
      feedbackRating: null,
      frustrationLevel: "none",
      waitTimeMinutes: 8,
      isReturningGuest: false,
      venueAvgTipPercent: 15,
      experienceScore: 9,
      marketRegion: "de",
    });

    expect(result.presets).toEqual([10, 15, 20]);
    expect(result.defaultIndex).toBe(1);
    expect(result.defaultPercent).toBe(15);
    expect(result.showProminent).toBe(true);
    expect(tipAmountFromPercent(100, 15)).toBe(15);
  });

  it("cultural=DE → Trinkgeld copy and region de", () => {
    const result = resolveTipSuggestion({
      orderTotal: 40,
      feedbackRating: 5,
      frustrationLevel: "none",
      waitTimeMinutes: 10,
      isReturningGuest: false,
      venueAvgTipPercent: 15,
      experienceScore: 9,
      language: "de",
    });

    expect(result.marketRegion).toBe("de");
    expect(result.personalMessage).toMatch(/Trinkgeld/i);
    expect(
      buildSettlingTipDenisMessage({ language: "de", experienceScore: 9 })
    ).toMatch(/Trinkgeld/i);
  });

  it("score=3 → minimal UI (0% default, not prominent)", () => {
    const result = resolveTipSuggestion({
      orderTotal: 100,
      feedbackRating: 5,
      frustrationLevel: "none",
      waitTimeMinutes: 30,
      isReturningGuest: false,
      venueAvgTipPercent: 15,
      experienceScore: 3,
      language: "sr",
    });

    expect(result.presets).toEqual([0, 5, 10]);
    expect(result.defaultIndex).toBe(0);
    expect(result.defaultPercent).toBe(0);
    expect(result.showProminent).toBe(false);
    expect(
      buildSettlingTipDenisMessage({ language: "sr", experienceScore: 3 })
    ).toBeNull();
  });

  it("US region uses higher defaults when score > 8", () => {
    const result = resolveTipSuggestion({
      orderTotal: 100,
      feedbackRating: null,
      frustrationLevel: "none",
      waitTimeMinutes: 8,
      isReturningGuest: false,
      venueAvgTipPercent: 15,
      experienceScore: 9,
      marketRegion: "us",
    });

    expect(result.presets).toEqual([15, 20, 25]);
    expect(result.defaultPercent).toBe(20);
  });

  it("Balkan region de-emphasizes tipping for mid scores", () => {
    const result = resolveTipSuggestion({
      orderTotal: 100,
      feedbackRating: null,
      frustrationLevel: "none",
      waitTimeMinutes: 8,
      isReturningGuest: false,
      venueAvgTipPercent: 15,
      experienceScore: 6,
      marketRegion: "balkan",
    });

    expect(result.showProminent).toBe(false);
    expect(result.defaultPercent).toBe(5);
  });

  it("personalizes message with waiter name on positive sentiment", () => {
    const result = resolveTipSuggestion({
      orderTotal: 40,
      feedbackRating: 5,
      frustrationLevel: "none",
      waitTimeMinutes: 10,
      isReturningGuest: false,
      venueAvgTipPercent: 15,
      waiterName: "Marko",
      language: "de",
      experienceScore: 9,
      marketRegion: "de",
    });

    expect(result.personalMessage).toContain("Marko");
    expect(result.denisMessage).toContain("Marko");
  });
});

describe("resolveTipMarketRegion", () => {
  it("maps de language to de region", () => {
    expect(resolveTipMarketRegion({ language: "de" })).toBe("de");
  });

  it("maps en language to us region", () => {
    expect(resolveTipMarketRegion({ language: "en" })).toBe("us");
  });

  it("maps sr language to balkan region", () => {
    expect(resolveTipMarketRegion({ language: "sr" })).toBe("balkan");
  });
});

describe("aggregateTipAnalytics", () => {
  it("computes daily avg tip and Denis correlation", () => {
    const snapshot = aggregateTipAnalytics([
      {
        tipAmount: 15,
        orderTotal: 100,
        createdAt: "2026-06-01T12:00:00.000Z",
        denisPromptShown: true,
      },
      {
        tipAmount: 10,
        orderTotal: 100,
        createdAt: "2026-06-02T12:00:00.000Z",
        smartDefaultUsed: true,
      },
    ]);

    expect(snapshot.tipCount).toBe(2);
    expect(snapshot.avgTipPercent).toBe(12.5);
    expect(snapshot.daily).toHaveLength(2);
    expect(snapshot.denisCorrelation).toBeGreaterThan(0);
  });
});

describe("buildSmartTipOffer", () => {
  function baseState(
    overrides: Partial<TableSessionState> = {}
  ): TableSessionState {
    return {
      table: { id: "t1", name: "Sto 4", token: "tok" },
      session: {
        id: "00000000-0000-4000-8000-000000000010",
        status: "active",
        accessState: null,
        billSettled: true,
        feedbackSubmitted: true,
        denisEnabled: true,
        denisActive: true,
      },
      commerce: {
        orders: [
          {
            id: "o1",
            orderNumber: 12,
            status: "delivered",
            paymentStatus: "paid",
            estimatedPrepMinutes: 15,
            createdAt: new Date().toISOString(),
            deliveredAt: new Date().toISOString(),
            tipAmount: 0,
            items: [
              {
                productId: "p1",
                productName: "Burger",
                quantity: 1,
                lineTotalCents: 420000,
              },
            ],
          },
        ],
        cart: buildMergedCart({ ai: emptyCartState() }),
      },
      venue: {
        ops: {
          operatingMode: "normal",
          kdsStress: "normal",
          acceptingOrders: true,
          unavailableProductIds: [],
          staffHint: null,
          stationStress: [],
        },
        opsEffects: {
          skipUpsell: false,
          shortenReplies: false,
          empathyNote: null,
          guestSafeStaffHint: null,
        },
      },
      conversation: {
        flowNodeId: "idle",
        foodUpsellAsked: false,
        dismissedNudges: [],
        lastAssistantMessage: null,
        pendingSlot: null,
        model: emptyConversationModel(),
        obligation: null,
      },
      timeline: [],
      browse: emptyBrowseProfile(),
      mental: {
        ...emptyGuestMentalModel(),
        affect: {
          frustration: { level: "none", signals: [] },
          sentiment: { score: 0.8, lastSignals: [] },
        },
      },
      offer: emptyGuestOfferContext(),
      guest: emptyGuestMemoryProjection({
        preferredLanguage: "sr",
        visitCount: 5,
        lastFeedbackSentiment: "positive",
      }),
      config: CONCIERGE_PLATFORM_DEFAULTS,
      ...overrides,
    };
  }

  it("projects smart tip offer when capability active and session eligible", () => {
    const enabledPolicy: CommercePolicy = {
      ...DEFAULT_COMMERCE_POLICY,
      capabilities: {
        ...DEFAULT_COMMERCE_POLICY.capabilities,
        "tips.smart_defaults": {
          enabled: true,
          rollout: {
            mode: "denis_only",
            canaryPercent: 100,
            tableSessionActorEnabled: false,
          },
          params: { venueAvgTipPercent: 15, marketRegion: "us" },
        },
      },
    };

    const offer = buildSmartTipOffer({
      state: baseState(),
      phase: "settling",
      language: "en",
      policy: enabledPolicy,
    });

    expect(offer).not.toBeNull();
    expect(offer?.marketRegion).toBe("us");
    expect(offer?.titleKey).toBe("tip.title");
  });

  it("skips tip offer during waiting phase", () => {
    const offer = buildSmartTipOffer({
      state: baseState(),
      phase: "waiting",
    });
    expect(offer).toBeNull();
  });

  it("skips when tip already recorded", () => {
    const state = baseState();
    state.commerce.orders[0]!.tipAmount = 5;
    const offer = buildSmartTipOffer({ state, phase: "settling" });
    expect(offer).toBeNull();
  });
});

describe("formatStaffTipCelebrationLine", () => {
  it("formats staff copilot celebration copy", () => {
    expect(
      formatStaffTipCelebrationLine({
        tableName: "Sto 4",
        tipPercent: 15,
        tipAmount: 630,
        staffName: "Marko",
        currency: "RSD",
      })
    ).toBe("Sto 4: napojnica 15% (630.00 RSD) — hvala Marko");
  });

  it("formats pool split celebration copy", () => {
    expect(
      formatStaffTipCelebrationLine({
        tableName: "Sto 4",
        tipPercent: 10,
        tipAmount: 42,
        splitMode: "pool",
      })
    ).toContain("tim pool");
  });
});

describe("tips.smart_defaults capability", () => {
  it("is enabled under canary rollout", () => {
    expect(
      DEFAULT_COMMERCE_POLICY.capabilities["tips.smart_defaults"].enabled
    ).toBe(true);
  });

  it("respects cohort gating", () => {
    expect(
      typeof isCommerceCapabilityActive({
        capabilityId: "tips.smart_defaults",
        cohortKey: "00000000-0000-4000-8000-000000000010",
      })
    ).toBe("boolean");
  });
});
