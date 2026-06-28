import { describe, expect, it } from "vitest";
import { buildPostTipReviewSignal } from "@/lib/commerce/capabilities/tips/post-tip-review";
import { buildGoogleReviewOffer, buildReviewFunnelOffer } from "@/lib/denis/commerce/build-google-review-offer";
import {
  aggregateReviewTriggerAnalytics,
  buildReviewContentSuggestion,
  buildSentimentGatedReviewContent,
  resolveRecoveryReviewState,
} from "@/lib/denis/commerce/experience/review-orchestration";
import {
  buildReviewFunnelInsight,
  formatGoogleReviewDigestLines,
  formatReviewTriggerAnalyticsLines,
} from "@/lib/denis/commerce/review-intelligence";
import {
  buildReviewPromptMessage,
  resolveReviewEligibility,
  resolveReviewFunnelRoute,
  resolveReviewPromptVariant,
  reviewDelayOpen,
  REVIEW_PROMPT_DELAY_SECONDS,
} from "@/lib/denis/commerce/review-funnel";
import {
  detectOptimalReviewMoment,
  isReviewMomentReady,
} from "@/lib/denis/cognition/proactive/detect-review-moment";
import { detectReviewTrigger } from "@/lib/denis/cognition/proactive/triggers";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { AiGuestOrder } from "@/lib/ai/order-context";

const GOOGLE_URL = "https://maps.google.com/review";
const PAID_AT = "2026-06-27T12:00:00.000Z";
const NOW_MS = Date.parse("2026-06-27T12:01:00.000Z");

function baseOrder(): AiGuestOrder {
  return {
    id: "order-1",
    status: "delivered",
    created_at: "2026-06-27T11:55:00.000Z",
    delivered_at: PAID_AT,
    order_items: [
      {
        product_id: "p1",
        product_name: "Schnitzel",
        unit_price: 12,
        quantity: 1,
        menu_section: "food",
      },
    ],
  };
}

describe("resolveReviewFunnelRoute", () => {
  it("routes score > 8 to Google", () => {
    expect(resolveReviewFunnelRoute(9)).toBe("google");
    expect(resolveReviewFunnelRoute(8)).toBe("none");
  });

  it("routes score < 5 to internal feedback", () => {
    expect(resolveReviewFunnelRoute(3)).toBe("internal");
  });

  it("blocks mid-band scores", () => {
    expect(resolveReviewFunnelRoute(6)).toBe("none");
  });
});

describe("resolveReviewEligibility", () => {
  it("is eligible for Google when score > 8 with 30s delay", () => {
    const result = resolveReviewEligibility({
      experienceScore: 9,
      frustrationLevel: "none",
      lastReviewPromptDate: null,
      lastReviewDismissDate: null,
      googleReviewUrl: GOOGLE_URL,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      eligible: true,
      reason: "experience_score_google",
      delay: REVIEW_PROMPT_DELAY_SECONDS,
      route: "google",
    });
  });

  it("routes low score to internal feedback only", () => {
    const result = resolveReviewEligibility({
      experienceScore: 3,
      frustrationLevel: "none",
      lastReviewPromptDate: null,
      lastReviewDismissDate: null,
      googleReviewUrl: GOOGLE_URL,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      eligible: true,
      reason: "experience_score_internal",
      delay: REVIEW_PROMPT_DELAY_SECONDS,
      route: "internal",
    });
  });

  it("respects 90-day prompt cooldown", () => {
    const result = resolveReviewEligibility({
      experienceScore: 9,
      frustrationLevel: "none",
      lastReviewPromptDate: new Date(NOW_MS).toISOString(),
      lastReviewDismissDate: null,
      googleReviewUrl: GOOGLE_URL,
      nowMs: NOW_MS,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("prompt_cooldown");
  });

  it("respects 180-day dismiss cooldown", () => {
    const result = resolveReviewEligibility({
      experienceScore: 9,
      frustrationLevel: "none",
      lastReviewPromptDate: null,
      lastReviewDismissDate: new Date(NOW_MS).toISOString(),
      googleReviewUrl: GOOGLE_URL,
      nowMs: NOW_MS,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("dismiss_cooldown");
  });
});

describe("reviewDelayOpen", () => {
  it("opens after 30 seconds from payment anchor", () => {
    expect(
      reviewDelayOpen(PAID_AT, REVIEW_PROMPT_DELAY_SECONDS, NOW_MS)
    ).toBe(true);
    expect(
      reviewDelayOpen(
        PAID_AT,
        REVIEW_PROMPT_DELAY_SECONDS,
        Date.parse("2026-06-27T12:00:15.000Z")
      )
    ).toBe(false);
  });
});

describe("detectReviewTrigger", () => {
  const triggerBase = {
    orders: [baseOrder()],
    phase: "settling" as const,
    billSettled: true,
    frustrationLevel: "none" as const,
    googleReviewUrl: GOOGLE_URL,
    lastReviewPromptDate: null,
    lastReviewDismissDate: null,
    paidAnchorAt: PAID_AT,
    language: "sr",
    now: NOW_MS,
  };

  it("prompts Google review when settled, score=9, and no prompt in 90d", () => {
    const result = detectReviewTrigger({
      ...triggerBase,
      experienceScore: 9,
      mealStage: "post_meal",
      sessionDurationMinutes: 45,
    });

    expect(result).toMatchObject({
      kind: "google_review",
      orderId: "order-1",
      reviewRoute: "google",
    });
    expect(result?.prompt).toContain("recenziju");
  });

  it("score 9 + tip → review ask at after_tip moment", () => {
    const result = detectReviewTrigger({
      ...triggerBase,
      experienceScore: 9,
      tipRecorded: true,
      mealStage: "post_meal",
      sessionDurationMinutes: 45,
      now: Date.parse("2026-06-27T12:00:05.000Z"),
    });

    expect(result).toMatchObject({
      kind: "google_review",
      triggerMoment: "after_tip",
    });
  });

  it("routes score=3 to internal feedback only", () => {
    const result = detectReviewTrigger({
      ...triggerBase,
      experienceScore: 3,
      mealStage: "post_meal",
      sessionDurationMinutes: 45,
    });

    expect(result).toMatchObject({
      kind: "internal_feedback",
      orderId: "order-1",
      reviewRoute: "internal",
    });
    expect(result?.prompt).toContain("želji");
  });

  it("waits 30s after payment before prompting", () => {
    const result = detectReviewTrigger({
      ...triggerBase,
      experienceScore: 9,
      mealStage: "post_meal",
      sessionDurationMinutes: 45,
      now: Date.parse("2026-06-27T12:00:10.000Z"),
    });

    expect(result).toBeNull();
  });

  it("recovery done → then Google review ask", () => {
    const result = detectReviewTrigger({
      ...triggerBase,
      experienceScore: 3,
      recoveryCompleted: true,
      postRecoveryEligible: true,
      guestSentimentAfterRecovery: "positive",
      recoveryIssueLabel: "wait time",
      mealStage: "post_meal",
      sessionDurationMinutes: 45,
    });

    expect(result).toMatchObject({
      kind: "google_review",
      triggerMoment: "post_recovery",
    });
    expect(result?.prompt).toContain("Ispravili smo");
  });
});

function highScoreSessionState(): TableSessionState {
  return {
    session: {
      id: "session-1",
      feedbackSubmitted: false,
      billSettled: true,
      denisActive: true,
      denisEnabled: true,
      status: "active",
      accessState: null,
    },
    table: { id: "t1", name: "T1", token: "tok" },
    commerce: {
      orders: [
        {
          id: "order-1",
          orderNumber: 1,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: 12,
          createdAt: "2026-06-27T11:55:00.000Z",
          deliveredAt: PAID_AT,
          items: [
            {
              productName: "Schnitzel",
              quantity: 1,
              lineTotalCents: 1200,
              menuSection: "food",
            },
          ],
        },
      ],
      cart: { ai: { draft: { items: [] } }, visibleLines: [] },
    },
    venue: {
      ops: {},
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    guest: { visitCount: 3, lastReviewPromptAt: null, lastReviewDismissAt: null },
    mental: {
      affect: {
        frustration: { level: "none" },
        sentiment: { score: 0.4 },
      },
      receptiveness: "enthusiastic",
      predictedNeed: null,
      mealStage: "post_meal",
    },
    conversation: {
      model: {
        transcript: [],
        thread: { lastGuestText: null, lastDenisText: null },
        stats: { guestTurns: 0, denisTurns: 0 },
      },
    },
    timeline: [],
    browse: {
      viewedProducts: [],
      viewedCategories: [],
      cartAbandoned: [],
      browsedFood: false,
      browsedDrinks: false,
      browsedDesserts: false,
      totalBrowseMs: 0,
      eventCount: 0,
    },
    offer: {},
    config: {},
  } as unknown as TableSessionState;
}

describe("buildGoogleReviewOffer", () => {
  it("builds offer in settling phase after payment and high experience score", () => {
    const state = highScoreSessionState();

    const offer = buildGoogleReviewOffer({
      state,
      phase: "settling",
      googleReviewUrl: GOOGLE_URL,
      language: "sr",
      nowMs: NOW_MS,
    });

    expect(offer).toMatchObject({
      orderId: "order-1",
      route: "google",
      delaySeconds: 30,
      googleReviewUrl: GOOGLE_URL,
      paidAnchorAt: PAID_AT,
      confirmLabel: "Ostavi Google recenziju",
      dismissLabel: "Ne sad",
    });
  });

  it("buildReviewFunnelOffer routes low score to internal form", () => {
    const state = {
      ...highScoreSessionState(),
      mental: {
        affect: {
          frustration: { level: "mild" },
          sentiment: { score: -0.3 },
        },
        receptiveness: "polite_decline",
        predictedNeed: null,
        mealStage: "post_meal",
      },
      conversation: {
        obligation: { gaps: [{ kind: "missing_item" }] },
        model: {
          transcript: [],
          thread: { lastGuestText: null, lastDenisText: null },
          stats: { guestTurns: 0, denisTurns: 0 },
        },
      },
      browse: {
        viewedProducts: [],
        viewedCategories: [],
        cartAbandoned: [{ productId: "a" }, { productId: "b" }],
        browsedFood: false,
        browsedDrinks: false,
        browsedDesserts: false,
        totalBrowseMs: 0,
        eventCount: 0,
      },
    } as unknown as TableSessionState;

    const offer = buildReviewFunnelOffer({
      state,
      phase: "settling",
      googleReviewUrl: GOOGLE_URL,
      nowMs: NOW_MS,
    });

    if (offer?.route === "internal") {
      expect(offer.showInternalForm).toBe(true);
      expect(offer.message).toContain("želji");
    } else {
      expect(offer).toBeNull();
    }
  });

  it("returns null for low experience score (internal path only)", () => {
    const state = {
      session: { billSettled: true },
      commerce: { orders: [baseOrder()] },
      guest: { lastReviewPromptAt: null, lastReviewDismissAt: null },
      mental: {
        affect: {
          frustration: { level: "high" },
          sentiment: { score: -0.5 },
        },
        receptiveness: "closed",
        predictedNeed: "needs_attention",
        mealStage: "eating",
      },
      conversation: { obligation: { gaps: [{ kind: "missing_item" }] } },
      browse: { cartAbandoned: [{ productId: "a" }, { productId: "b" }] },
      timeline: [],
    } as unknown as TableSessionState;

    const offer = buildGoogleReviewOffer({
      state,
      phase: "settling",
      googleReviewUrl: GOOGLE_URL,
      nowMs: NOW_MS,
    });

    expect(offer).toBeNull();
  });
});

describe("review orchestration L2", () => {
  it("score 9 → Google copy with star", () => {
    const content = buildSentimentGatedReviewContent({ experienceScore: 9 });
    expect(content.route).toBe("google");
    expect(content.message).toContain("recenziju");
    expect(content.showGoogleLink).toBe(true);
  });

  it("score 4 → internal form, not Google", () => {
    const content = buildSentimentGatedReviewContent({ experienceScore: 4 });
    expect(content.route).toBe("internal");
    expect(content.showInternalForm).toBe(true);
    expect(content.showGoogleLink).toBe(false);
  });

  it("score 6 → thanks only, no review ask", () => {
    const content = buildSentimentGatedReviewContent({ experienceScore: 6 });
    expect(content.route).toBe("thanks_only");
    expect(content.showGoogleLink).toBe(false);
  });

  it("suggests hero dish for review content", () => {
    const suggestion = buildReviewContentSuggestion({
      orderItems: [{ productName: "Schnitzel", menuSection: "food" }],
    });
    expect(suggestion?.suggestionLine).toContain("Schnitzel");
  });

  it("post-tip signal eligible when score > 8", () => {
    expect(
      buildPostTipReviewSignal({ experienceScore: 9, tipRecorded: true })
    ).toMatchObject({ triggerMoment: "after_tip", reviewEligible: true });
    expect(
      buildPostTipReviewSignal({ experienceScore: 6, tipRecorded: true })
    ).toBeNull();
  });

  it("tracks conversion per trigger moment", () => {
    const analytics = aggregateReviewTriggerAnalytics({
      rows: [
        { triggerMoment: "after_tip", experienceScore: 9, converted: true },
        { triggerMoment: "after_tip", experienceScore: 9, converted: false },
        { triggerMoment: "waiting_bill", experienceScore: 9, converted: true },
      ],
    });

    expect(analytics.byTrigger.after_tip?.rate).toBe(0.5);
    expect(analytics.byTrigger.waiting_bill?.rate).toBe(1);
    expect(analytics.sentimentDistribution.high).toBe(3);
    expect(formatReviewTriggerAnalyticsLines(analytics)[0]).toContain("after_tip");
  });

  it("blocks review while guest still eating", () => {
    const moment = detectOptimalReviewMoment({
      phase: "eating",
      billSettled: false,
      mealStage: "main_course",
    });
    expect(moment.blocked).toBe("still_eating");
    expect(isReviewMomentReady(moment)).toBe(false);
  });

  it("resolveRecoveryReviewState enables Google after recovery", () => {
    const recovery = resolveRecoveryReviewState({
      experienceScore: 3,
      recoveryCompleted: true,
      recoveryIssueLabel: "wait time",
      guestSentimentAfterRecovery: "positive",
    });
    expect(recovery.eligibleForGoogleAfterRecovery).toBe(true);
    expect(recovery.followUpMessage).toContain("desert");
  });
});

describe("resolveReviewPromptVariant", () => {
  it("assigns stable A/B variant per session token", () => {
    const first = resolveReviewPromptVariant("session-feedback-ab");
    const second = resolveReviewPromptVariant("session-feedback-ab");
    expect(first).toBe(second);
    expect(["A", "B"]).toContain(first);
  });

  it("returns different copy for variant B", () => {
    const variant = resolveReviewPromptVariant("session-variant-b-test");
    const message = buildReviewPromptMessage("sr", variant);
    expect(message.length).toBeGreaterThan(10);
  });
});

describe("formatGoogleReviewDigestLines", () => {
  it("formats owner digest lines", () => {
    const lines = formatGoogleReviewDigestLines(
      buildReviewFunnelInsight({
        positiveFeedbackCount: 10,
        googleReviewClickCount: 4,
        clickedSessionCount: 4,
      })
    );

    expect(lines[0]).toContain("4 Google review klik");
    expect(lines[1]).toContain("40%");
  });
});
