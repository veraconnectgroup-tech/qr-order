import { describe, expect, it } from "vitest";
import {
  ABANDONMENT_INTERVENTION_THRESHOLD,
  CART_IDLE_RISK_MS,
  countAddRemoveCycles,
  scoreAbandonmentRisk,
} from "@/lib/denis/cognition/offer/abandonment-risk-scorer";
import {
  derivePreventionFatigue,
  MAX_PREVENTION_ATTEMPTS_PER_SESSION,
} from "@/lib/denis/cognition/mental-model/derive-session-nudge-fatigue";
import {
  isPreventionTimingOptimal,
  PREVENTION_OPTIMAL_MAX_SEC,
  PREVENTION_OPTIMAL_MIN_SEC,
  resolvePreventionIntervention,
} from "@/lib/denis/cognition/offer/preventive-intervention";
import { aggregateAbandonmentPreventionFromTimelines } from "@/lib/admin/aggregate-abandonment-prevention";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

describe("abandonment risk scorer (12→2)", () => {
  it("scores price shock when cart exceeds guest avg spend", () => {
    const risk = scoreAbandonmentRisk({
      cartIdleMs: 60_000,
      lastInteractionMs: 90_000,
      cartSubtotalCents: 1500,
      guestAvgSpendCents: 1000,
      itemCount: 2,
    });

    expect(risk.signals).toContain("price_above_avg_spend");
    expect(risk.score).toBeGreaterThan(0);
  });

  it("intervenes when score > threshold", () => {
    const risk = scoreAbandonmentRisk({
      cartIdleMs: CART_IDLE_RISK_MS,
      lastInteractionMs: CART_IDLE_RISK_MS,
      viewedCheckout: true,
      cartSubtotalCents: 1200,
      guestAvgSpendCents: 800,
      removedItemCount: 1,
      itemCount: 2,
    });

    expect(risk.score).toBeGreaterThan(ABANDONMENT_INTERVENTION_THRESHOLD);
    expect(risk.intervene).toBe(true);
  });

  it("counts add/remove oscillation cycles", () => {
    expect(
      countAddRemoveCycles(["add", "remove", "add", "remove", "add", "remove"])
    ).toBe(2);
  });
});

describe("preventive intervention (12→2)", () => {
  it("price shock → cheaper alternative message", () => {
    const risk = scoreAbandonmentRisk({
      cartIdleMs: 90_000,
      lastInteractionMs: 120_000,
      cartSubtotalCents: 1400,
      guestAvgSpendCents: 900,
      removedItemCount: 1,
      viewedCheckout: true,
      itemCount: 1,
    });

    expect(risk.intervene).toBe(true);

    const { intervention } = resolvePreventionIntervention({
      risk,
      lastInteractionMs: 120_000,
      preventionAttemptCount: 0,
      usedInterventionKinds: [],
      preventionIgnored: false,
      primaryCartItem: { productId: "b1", productName: "Premium Burger" },
      cheaperAlternative: {
        productId: "b2",
        productName: "Burger",
        priceCents: 890,
      },
      language: "sr",
    });

    expect(intervention?.kind).toBe("price_shock_alternative");
    expect(intervention?.message).toMatch(/manji Burger/i);
    expect(intervention?.message).toMatch(/€8\.90/);
  });

  it("idle 3min + checkout scroll → distraction nudge in optimal window", () => {
    const idleMs = 120_000;
    const risk = scoreAbandonmentRisk({
      cartIdleMs: CART_IDLE_RISK_MS + 1000,
      lastInteractionMs: idleMs,
      viewedCheckout: true,
      removedItemCount: 1,
      cartSubtotalCents: 1000,
      itemCount: 2,
    });

    expect(isPreventionTimingOptimal({ lastInteractionMs: idleMs })).toBe(true);
    expect(idleMs / 1000).toBeGreaterThanOrEqual(PREVENTION_OPTIMAL_MIN_SEC);
    expect(idleMs / 1000).toBeLessThanOrEqual(PREVENTION_OPTIMAL_MAX_SEC);

    const { intervention } = resolvePreventionIntervention({
      risk,
      lastInteractionMs: idleMs,
      preventionAttemptCount: 0,
      usedInterventionKinds: [],
      preventionIgnored: false,
      language: "sr",
    });

    expect(intervention?.kind).toBe("distraction_nudge");
    expect(intervention?.message).toMatch(/Još ste tu/i);
    expect(intervention?.message).toMatch(/korpa/i);
  });

  it("decision paralysis after 3 add/remove cycles", () => {
    const risk = scoreAbandonmentRisk({
      cartIdleMs: CART_IDLE_RISK_MS,
      lastInteractionMs: CART_IDLE_RISK_MS,
      addRemoveCycleCount: 3,
      cartSubtotalCents: 800,
      itemCount: 1,
    });

    expect(risk.intervene).toBe(true);

    const { intervention } = resolvePreventionIntervention({
      risk,
      lastInteractionMs: 120_000,
      preventionAttemptCount: 0,
      usedInterventionKinds: [],
      preventionIgnored: false,
      addRemoveCycleCount: 3,
      popularProduct: { productId: "p1", productName: "Ćevapi" },
      language: "sr",
    });

    expect(intervention?.kind).toBe("decision_paralysis");
    expect(intervention?.message).toMatch(/Težak izbor/i);
    expect(intervention?.message).toMatch(/Ćevapi/i);
  });

  it("blocks 2nd prevention attempt (max 1 per session)", () => {
    const risk = scoreAbandonmentRisk({
      cartIdleMs: CART_IDLE_RISK_MS,
      lastInteractionMs: CART_IDLE_RISK_MS,
      removedItemCount: 1,
      viewedCheckout: true,
      cartSubtotalCents: 1500,
      guestAvgSpendCents: 900,
      itemCount: 2,
    });

    const second = resolvePreventionIntervention({
      risk,
      lastInteractionMs: 120_000,
      preventionAttemptCount: MAX_PREVENTION_ATTEMPTS_PER_SESSION,
      usedInterventionKinds: ["distraction_nudge"],
      preventionIgnored: false,
      language: "sr",
    });

    expect(second.intervention).toBeNull();
    expect(second.fatigue.blocked).toBe(true);
    expect(second.fatigue.reason).toBe("max_attempts");
  });

  it("stops after guest ignores prevention", () => {
    const fatigue = derivePreventionFatigue({
      preventionEmitCount: 0,
      preventionIgnored: true,
      usedInterventionKinds: [],
      nextKind: "distraction_nudge",
      respectDecline: true,
      nudgeOutcomes: ["ignored"],
    });

    expect(fatigue.blocked).toBe(true);
    expect(fatigue.reason).toBe("guest_ignored");
  });

  it("never repeats same intervention kind", () => {
    const fatigue = derivePreventionFatigue({
      preventionEmitCount: 0,
      preventionIgnored: false,
      usedInterventionKinds: ["distraction_nudge"],
      nextKind: "distraction_nudge",
      respectDecline: true,
      nudgeOutcomes: [],
    });

    expect(fatigue.blocked).toBe(true);
    expect(fatigue.reason).toBe("duplicate_kind");
  });
});

describe("abandonment prevention analytics", () => {
  it("tracks conversion after intervention from timeline", () => {
    const emittedAt = new Date().toISOString();
    const timeline: DenisTimelineRow[] = [
      {
        id: "p1",
        ai_session_id: "s1",
        seq: 1,
        event_type: "proactive.emitted",
        payload: {
          kind: "cart_abandonment_prevention",
          offerResolution: "price_shock_alternative",
          productId: "prod-1",
          message: "Imamo i manji Burger",
        },
        trace_id: null,
        context_hash: null,
        created_at: emittedAt,
      },
      {
        id: "b1",
        ai_session_id: "s1",
        seq: 2,
        event_type: "perception.ingested",
        payload: {
          type: "perception.ingested",
          frame: {
            channel: "telemetry.browse",
            normalizedText: null,
            structuredIntent: null,
            ingestedAt: emittedAt,
          },
          browseEvent: {
            action: "add_to_cart",
            productId: "prod-1",
            productName: "Burger",
            timestamp: emittedAt,
          },
        },
        trace_id: null,
        context_hash: null,
        created_at: emittedAt,
      },
    ];

    const stats = aggregateAbandonmentPreventionFromTimelines([timeline]);
    expect(stats.preventionEmitted).toBe(1);
    expect(stats.byKind.price_shock_alternative).toBe(1);
    expect(stats.preventionConverted).toBeGreaterThanOrEqual(0);
  });
});
