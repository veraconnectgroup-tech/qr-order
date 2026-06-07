import { describe, expect, it } from "vitest";
import { deriveNudgeBudget } from "@/lib/denis/cognition/mental-model/derive-nudge-budget";
import { deriveSessionNudgeFatigue } from "@/lib/denis/cognition/mental-model/derive-session-nudge-fatigue";
import { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";
import {
  buildAnticipationResolvedPayload,
  findNewNudgeOutcomes,
} from "@/lib/denis/cognition/offer/nudge-outcome-timeline";
import { buildNudgeId } from "@/lib/denis/cognition/offer/nudge-outcome-types";
import { browseRow } from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const BURGER = "11111111-1111-4111-8111-111111111111";
const EMIT_AT = "2026-06-07T12:20:00.000Z";
const CART_AT = "2026-06-07T12:22:30.000Z";
const MSG_AT = "2026-06-07T12:21:00.000Z";
const DECLINE_AT = "2026-06-07T12:21:30.000Z";
const EXPIRE_NOW = new Date("2026-06-07T12:26:00.000Z").getTime();

function proactiveEmittedRow(
  seq: number,
  at: string,
  productId: string,
  productName: string
): DenisTimelineRow {
  return {
    id: `emit-${seq}`,
    ai_session_id: "ai-session-1",
    seq,
    event_type: "proactive.emitted",
    payload: {
      type: "proactive.emitted",
      kind: "browse_nudge",
      message: `Hoćete ${productName}?`,
      orderId: null,
      tier: "template",
      productId,
      productName,
      offerResolution: "top_dwell",
    },
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: at,
  };
}

function guestMessageRow(seq: number, at: string, text: string): DenisTimelineRow {
  return {
    id: `msg-${seq}`,
    ai_session_id: "ai-session-1",
    seq,
    event_type: "signal.message",
    payload: {
      type: "signal.message",
      text,
      channel: "chat.message",
    },
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: at,
  };
}

function dismissRow(seq: number, at: string, keys: string[]): DenisTimelineRow {
  return {
    id: `dismiss-${seq}`,
    ai_session_id: "ai-session-1",
    seq,
    event_type: "realtime.ingested",
    payload: {
      type: "realtime.ingested",
      source: "telemetry.scroll",
      payload: { dismissedNudgeKeys: keys },
    },
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: at,
  };
}

describe("foldNudgeOutcomes", () => {
  it("resolves accepted when add_to_cart within 180s", () => {
    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      browseRow(2, {
        action: "add_to_cart",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food"],
        menuSection: "food",
        timestamp: CART_AT,
      }),
    ];

    const { outcomes, pending } = foldNudgeOutcomes(timeline);
    expect(pending).toHaveLength(0);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      outcome: "accepted",
      signal: "add_to_cart",
      productId: BURGER,
      lagMs: 150_000,
    });
  });

  it("resolves declined on explicit guest decline", () => {
    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      guestMessageRow(2, DECLINE_AT, "Ne hvala, samo voda"),
    ];

    const { outcomes } = foldNudgeOutcomes(timeline);
    expect(outcomes[0]).toMatchObject({
      outcome: "declined",
      signal: "explicit_decline",
    });
  });

  it("resolves declined on banner dismiss", () => {
    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      dismissRow(2, DECLINE_AT, ["browse_nudge"]),
    ];

    const { outcomes } = foldNudgeOutcomes(timeline);
    expect(outcomes[0]).toMatchObject({
      outcome: "declined",
      signal: "dismiss",
    });
  });

  it("resolves ignored on unrelated guest message", () => {
    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      guestMessageRow(2, MSG_AT, "Gde je wc?"),
    ];

    const { outcomes } = foldNudgeOutcomes(timeline);
    expect(outcomes[0]).toMatchObject({
      outcome: "ignored",
      signal: "guest_message_unrelated",
    });
  });

  it("resolves expired after 300s without guest reaction", () => {
    const timeline = [proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger")];

    const { outcomes, pending } = foldNudgeOutcomes(timeline, EXPIRE_NOW);
    expect(pending).toHaveLength(0);
    expect(outcomes[0]).toMatchObject({
      outcome: "expired",
      signal: "timeout",
      lagMs: null,
    });
  });

  it("computes session attach rate across outcomes", () => {
    const emit2 = "2026-06-07T12:30:00.000Z";
    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      browseRow(2, {
        action: "add_to_cart",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food"],
        menuSection: "food",
        timestamp: CART_AT,
      }),
      proactiveEmittedRow(3, emit2, BURGER, "Beef Burger"),
      guestMessageRow(4, "2026-06-07T12:31:00.000Z", "Ne hvala"),
    ];

    const { sessionAttachRate } = foldNudgeOutcomes(timeline);
    expect(sessionAttachRate).toBe(0.5);
  });
});

describe("findNewNudgeOutcomes", () => {
  it("skips outcomes already logged as anticipation.resolved", () => {
    const nudgeId = buildNudgeId({
      kind: "browse_nudge",
      productId: BURGER,
      emittedAt: EMIT_AT,
    });
    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      guestMessageRow(2, DECLINE_AT, "Ne hvala"),
      {
        id: "resolved-1",
        ai_session_id: "ai-session-1",
        seq: 3,
        event_type: "anticipation.resolved",
        payload: buildAnticipationResolvedPayload({
          nudgeId,
          nudgeKind: "browse_nudge",
          outcome: "declined",
          signal: "explicit_decline",
          productId: BURGER,
          productName: "Beef Burger",
          offerResolution: "top_dwell",
          emittedAt: EMIT_AT,
          resolvedAt: DECLINE_AT,
          lagMs: 90_000,
        }),
        trace_id: "trace-3",
        context_hash: null,
        created_at: DECLINE_AT,
      },
    ];

    expect(findNewNudgeOutcomes(timeline)).toHaveLength(0);
  });
});

describe("deriveSessionNudgeFatigue", () => {
  it("detects accept then double decline as exhausted", () => {
    expect(
      deriveSessionNudgeFatigue(["accepted", "declined", "declined"])
    ).toBe("exhausted");
  });

  it("detects low session attach rate as cooling", () => {
    expect(
      deriveSessionNudgeFatigue(["declined", "ignored", "expired"])
    ).toBe("cooling");
  });
});

describe("deriveNudgeBudget fatigue", () => {
  const base = {
    spine: {
      guestMessages: [],
      declineSignals: [],
      browseChurn: [],
      maxProductCartChurn: 0,
      proactivePairs: [],
      emittedProactiveKeys: ["browse_nudge"],
      recommendationAsked: false,
      guestInitiatedBeforeDenis: false,
      actionTimestamps: [],
    },
    decline: {
      dismissedCount: 0,
      explicitCount: 0,
      hardClosed: false,
      lastDeclineAt: null,
    },
    receptiveness: "open" as const,
    config: CONCIERGE_PLATFORM_DEFAULTS,
    now: Date.now(),
  };

  it("zeroes budget when session fatigue is exhausted", () => {
    const budget = deriveNudgeBudget({
      ...base,
      resolvedOutcomes: ["accepted", "declined", "declined"],
    });
    expect(budget.remaining).toBe(0);
    expect(budget.max).toBe(0);
  });
});
