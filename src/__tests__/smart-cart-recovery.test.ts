import { describe, expect, it } from "vitest";
import {
  analyzeCartAbandon,
  filterCartActions,
  MAX_CART_RECOVERY_PER_SESSION,
  recoveryDelayOpen,
  resolveSmartCartRecoveryOffer,
  sliceBrowseAfterRemove,
} from "@/lib/denis/cognition/offer/smart-cart-recovery";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { BrowseSequenceEntry } from "@/lib/denis/cognition/offer/offer-types";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";

const STEAK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BURGER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = Date.parse("2026-06-07T12:30:00.000Z");

function mental(overrides: Partial<ReturnType<typeof emptyGuestMentalModel>> = {}) {
  return { ...emptyGuestMentalModel(NOW), ...overrides };
}

function abandoned(
  productId: string,
  productName: string,
  removedAt: string
): GuestBrowseProfile["cartAbandoned"][0] {
  return { productId, productName, removedAt };
}

function sequence(rows: BrowseSequenceEntry[]): BrowseSequenceEntry[] {
  return rows;
}

describe("smart cart recovery (N2)", () => {
  it("price_shock: removed steak (€28) then browsed burger (€14) → offer_alternative", () => {
    const removedAt = "2026-06-07T12:29:15.000Z";
    const allCartActions = filterCartActions(
      sequence([
        {
          at: "2026-06-07T12:29:00.000Z",
          action: "add_to_cart",
          productId: STEAK,
        },
        {
          at: removedAt,
          action: "remove_from_cart",
          productId: STEAK,
        },
      ])
    );
    const browseAfterRemove = sliceBrowseAfterRemove(
      sequence([
        ...allCartActions,
        {
          at: "2026-06-07T12:29:25.000Z",
          action: "view_product",
          productId: BURGER,
          menuSection: "food",
        },
      ]),
      removedAt
    );

    const plan = analyzeCartAbandon({
      abandonedItem: abandoned(STEAK, "Ribeye Steak", removedAt),
      browseAfterRemove,
      allCartActions,
      mental: mental({ pace: "indecisive", priceAffinity: "mid" }),
      viewedProducts: [
        {
          productId: STEAK,
          productName: "Ribeye Steak",
          categoryPath: ["food", "mains"],
          viewCount: 2,
          totalDwellMs: 8000,
          addedToCart: true,
          removedFromCart: true,
          disposition: "abandoned",
        },
        {
          productId: BURGER,
          productName: "Beef Burger",
          categoryPath: ["food", "burgers"],
          viewCount: 1,
          totalDwellMs: 5000,
          addedToCart: false,
          removedFromCart: false,
          disposition: "viewed",
        },
      ],
      productPricesCents: {
        [STEAK]: 2_800,
        [BURGER]: 1_400,
      },
      secondsSinceRemove: 45,
    });

    expect(plan.reason).toBe("price_shock");
    expect(plan.action).toBe("offer_alternative");
    expect(plan.alternativeProductId).toBe(BURGER);
    expect(plan.alternativeProductName).toBe("Beef Burger");
    expect(recoveryDelayOpen(plan, 45)).toBe(true);
  });

  it("replaced: added alternative after remove → skip", () => {
    const removedAt = "2026-06-07T12:29:15.000Z";
    const allCartActions = filterCartActions(
      sequence([
        {
          at: "2026-06-07T12:29:00.000Z",
          action: "add_to_cart",
          productId: STEAK,
        },
        { at: removedAt, action: "remove_from_cart", productId: STEAK },
        {
          at: "2026-06-07T12:29:20.000Z",
          action: "add_to_cart",
          productId: BURGER,
        },
      ])
    );

    const plan = analyzeCartAbandon({
      abandonedItem: abandoned(STEAK, "Ribeye Steak", removedAt),
      browseAfterRemove: sliceBrowseAfterRemove(allCartActions, removedAt),
      allCartActions,
      mental: mental({ pace: "indecisive" }),
      viewedProducts: [],
    });

    expect(plan.reason).toBe("replaced");
    expect(plan.action).toBe("skip");
  });

  it("allergy concern with safe browsed alternative → offer_alternative", () => {
    const removedAt = "2026-06-07T12:29:15.000Z";
    const plan = analyzeCartAbandon({
      abandonedItem: abandoned(STEAK, "Ribeye Steak", removedAt),
      browseAfterRemove: sliceBrowseAfterRemove(
        sequence([
          {
            at: "2026-06-07T12:29:20.000Z",
            action: "view_product",
            productId: BURGER,
          },
        ]),
        removedAt
      ),
      allCartActions: [],
      mental: mental({ pace: "indecisive" }),
      viewedProducts: [
        {
          productId: BURGER,
          productName: "Beef Burger",
          categoryPath: ["food", "burgers"],
          viewCount: 1,
          totalDwellMs: 4000,
          addedToCart: false,
          removedFromCart: false,
          disposition: "viewed",
        },
      ],
      sessionAllergieLabels: ["Gluten"],
      productAllergens: {
        [STEAK]: ["gluten"],
        [BURGER]: [],
      },
    });

    expect(plan.reason).toBe("allergy_concern");
    expect(plan.action).toBe("offer_alternative");
    expect(plan.alternativeProductId).toBe(BURGER);
  });

  it("allergy concern without safe alternative → skip", () => {
    const removedAt = "2026-06-07T12:29:15.000Z";
    const plan = analyzeCartAbandon({
      abandonedItem: abandoned(STEAK, "Ribeye Steak", removedAt),
      browseAfterRemove: [],
      allCartActions: [],
      mental: mental({ pace: "indecisive" }),
      viewedProducts: [],
      sessionAllergieLabels: ["Gluten"],
      productAllergens: { [STEAK]: ["gluten"] },
    });

    expect(plan.reason).toBe("allergy_concern");
    expect(plan.action).toBe("skip");
  });

  it("party mode → group_veto skip", () => {
    const plan = analyzeCartAbandon({
      abandonedItem: abandoned(STEAK, "Ribeye Steak", "2026-06-07T12:29:15.000Z"),
      browseAfterRemove: [],
      allCartActions: [],
      mental: mental({
        pace: "indecisive",
        groupDynamics: {
          mode: "party",
          leaderDevice: "dev-1",
          followerDevices: ["dev-2"],
          addressLeader: true,
        },
      }),
      viewedProducts: [],
    });

    expect(plan.reason).toBe("group_veto");
    expect(plan.action).toBe("skip");
  });

  it("indecisive idle → offer_same_later with 60s delay and copy", () => {
    const removedAt = "2026-06-07T12:29:15.000Z";
    const plan = analyzeCartAbandon({
      abandonedItem: abandoned(STEAK, "Ribeye Steak", removedAt),
      browseAfterRemove: [],
      allCartActions: filterCartActions(
        sequence([
          { at: "2026-06-07T12:29:00.000Z", action: "add_to_cart", productId: STEAK },
          { at: removedAt, action: "remove_from_cart", productId: STEAK },
        ])
      ),
      mental: mental({ pace: "indecisive" }),
      viewedProducts: [],
    });

    expect(plan.reason).toBe("indecisive");
    expect(plan.action).toBe("offer_same_later");
    expect(plan.delaySeconds).toBe(60);
    expect(plan.message).toContain("Još uvek razmišljate o Ribeye Steak");
    expect(recoveryDelayOpen(plan, 45)).toBe(false);
    expect(recoveryDelayOpen(plan, 65)).toBe(true);
  });

  it(`rate limit: max ${MAX_CART_RECOVERY_PER_SESSION} recovery per session`, () => {
    const plan = analyzeCartAbandon({
      abandonedItem: abandoned(STEAK, "Ribeye Steak", "2026-06-07T12:29:15.000Z"),
      browseAfterRemove: [],
      allCartActions: [],
      mental: mental({ pace: "indecisive" }),
      viewedProducts: [],
      cartRecoveryEmitCount: MAX_CART_RECOVERY_PER_SESSION,
    });

    expect(plan.action).toBe("skip");
  });

  it("rankProactiveCandidates emits cart_recovery when offer ready and delay open", () => {
    const removedAt = "2026-06-07T12:29:15.000Z";
    const base = emptyGuestOfferContext(NOW);
    const offer = {
      ...base,
      readiness: {
        ready: true,
        reason: "cart_hesitation" as const,
        secondsSinceLastBrowseAction: 12,
      },
      cartRecovery: {
        productId: BURGER,
        productName: "Beef Burger",
        categoryId: null,
        resolution: "cart_recovery" as const,
        score: 0.88,
        dedupeKey: "offer:cart_recovery:burger",
        isKitchenBlocked: false,
      },
      smartRecovery: {
        reason: "price_shock" as const,
        action: "offer_alternative" as const,
        delaySeconds: 30,
        message: "Ako vam je Ribeye Steak bilo previše — Beef Burger je odlična lakša opcija. Hoćete da dodam?",
        alternativeProductId: BURGER,
        alternativeProductName: "Beef Burger",
      },
      trace: {
        ...base.trace,
        strategy: "cart_recovery_price_alt",
      },
    };

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      offer,
      payload: {
        sessionPhase: "browsing",
        dismissedNudgeKeys: [],
        cartAbandonedRemovedAt: removedAt,
      },
      messages: {
        browse: "browse",
        dessert: "dessert",
        slowKitchen: "slow",
        guestWelcome: "welcome",
        browseFollowUp: "follow up",
        billPrompt: "bill",
        orderDelay: "delay",
        popularityPair: "pair",
      },
      now: NOW,
    });

    expect(ranked.some((row) => row.nudge.kind === "cart_recovery")).toBe(true);
    expect(ranked[0]?.nudge.kind).toBe("cart_recovery");
  });

  it("resolveSmartCartRecoveryOffer maps price_shock to cart_recovery_price_alt", () => {
    const removedAt = "2026-06-07T12:29:15.000Z";
    const result = resolveSmartCartRecoveryOffer({
      browse: {
        ...emptyBrowseProfile(),
        viewedProducts: [
          {
            productId: STEAK,
            productName: "Ribeye Steak",
            categoryPath: ["food"],
            viewCount: 2,
            totalDwellMs: 8000,
            addedToCart: true,
            removedFromCart: true,
            disposition: "abandoned",
          },
          {
            productId: BURGER,
            productName: "Beef Burger",
            categoryPath: ["food"],
            viewCount: 1,
            totalDwellMs: 5000,
            addedToCart: false,
            removedFromCart: false,
            disposition: "viewed",
          },
        ],
        cartAbandoned: [abandoned(STEAK, "Ribeye Steak", removedAt)],
        browsedFood: true,
        browsedDrinks: false,
        browsedDesserts: false,
        totalBrowseMs: 13000,
        eventCount: 3,
      },
      mental: mental({ pace: "indecisive", predictedNeed: "needs_help_choosing" }),
      sequence: sequence([
        { at: "2026-06-07T12:29:00.000Z", action: "add_to_cart", productId: STEAK },
        { at: removedAt, action: "remove_from_cart", productId: STEAK },
        {
          at: "2026-06-07T12:29:25.000Z",
          action: "view_product",
          productId: BURGER,
        },
      ]),
      sequencePattern: "normal_flow",
      readiness: {
        ready: true,
        reason: "cart_hesitation",
        secondsSinceLastBrowseAction: 10,
      },
      cartRecoveryEmitCount: 0,
      productPricesCents: { [STEAK]: 2_800, [BURGER]: 1_400 },
      nowMs: NOW,
    });

    expect(result?.strategy).toBe("cart_recovery_price_alt");
    expect(result?.cartRecovery?.productId).toBe(BURGER);
    expect(result?.plan.action).toBe("offer_alternative");
  });
});
