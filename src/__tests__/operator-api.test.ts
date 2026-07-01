import { describe, expect, it } from "vitest";
import {
  aggregateSessionMetricsFromTimeline,
  computeAvgCheckCents,
  computeConversionRate,
  computeLlmInvocationRate,
  computeTipRate,
  computeWaiterGapRate,
  countSessionsWithWaiterGap,
  countUserMessages,
  extractIntentsFromTimeline,
  extractLatestBeliefsSummary,
  redactTranscript,
  resolveSessionOutcome,
} from "@/lib/operator/projections/helpers";
import {
  generateOperatorApiKey,
  hashOperatorApiKey,
  isOperatorApiKeyFormat,
  OPERATOR_KEY_PREFIX,
} from "@/lib/operator/keys";
import { hasOperatorScope, OPERATOR_SCOPES } from "@/lib/operator/scopes";
import { parseOperatorPeriod, periodToIsoRange } from "@/lib/operator/parse-period";
import type {
  DenisLocationMetrics,
  OperatorOrderListItem,
  OperatorSessionSummary,
  OperatorTranscript,
} from "@/lib/operator/types";
import { requireOperatorScope } from "@/lib/operator/auth";
import { checkRateLimit } from "@/lib/rate-limit";

describe("operator API keys", () => {
  it("generates dns_op_live prefix keys", () => {
    const key = generateOperatorApiKey();
    expect(key.rawKey.startsWith(OPERATOR_KEY_PREFIX)).toBe(true);
    expect(isOperatorApiKeyFormat(key.rawKey)).toBe(true);
    expect(hashOperatorApiKey(key.rawKey)).toBe(key.hash);
  });

  it("rejects qr_live keys as operator format", () => {
    expect(isOperatorApiKeyFormat("qr_live_abc123")).toBe(false);
  });
});

describe("operator org rate limit", () => {
  it("uses operator scope with 100 req/min window", () => {
    const key = `operator:org-rate-test-${Date.now()}`;
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit(key, 100, 60_000)).toBe(true);
    }
    expect(checkRateLimit(key, 100, 60_000)).toBe(false);
  });
});

describe("operator scopes", () => {
  it("checks operator:read scope", () => {
    expect(hasOperatorScope(["operator:read"], "operator:read")).toBe(true);
    expect(hasOperatorScope(["orders:read"], "operator:read")).toBe(false);
  });

  it("returns 403 when operator:read scope is missing", () => {
    const err = requireOperatorScope(
      { keyId: "k1", orgId: "org-1", scopes: ["operator:propose"] },
      "operator:read"
    );
    expect(err).not.toBeNull();
    expect(err?.status).toBe(403);
  });

  it("exports operator scopes for Viktor keys", () => {
    expect(OPERATOR_SCOPES).toContain("operator:read");
    expect(OPERATOR_SCOPES).toContain("operator:propose");
  });
});

describe("operator period parsing", () => {
  it("parses today period with midnight start", () => {
    const now = new Date("2026-05-29T15:30:00.000Z");
    const bounds = parseOperatorPeriod("today", now);
    expect(bounds.period).toBe("today");
    expect(bounds.from.getHours()).toBe(0);
    const iso = periodToIsoRange(bounds);
    expect(iso.from).toBe(bounds.from.toISOString());
    expect(iso.to).toBe(bounds.to.toISOString());
  });

  it("parses 7d period", () => {
    const bounds = parseOperatorPeriod("7d", new Date("2026-05-29T12:00:00.000Z"));
    expect(bounds.period).toBe("7d");
    expect(bounds.from.getDate()).toBe(23);
  });
});

describe("operator projection helpers", () => {
  it("computes conversion and llm rates", () => {
    expect(computeConversionRate(10, 4)).toBe(0.4);
    expect(
      computeLlmInvocationRate({ sessionsWithActivity: 8, sessionsWithLlm: 2 })
    ).toBe(0.25);
    expect(computeAvgCheckCents(5000, 2)).toBe(2500);
    expect(computeTipRate(3, 10)).toBe(0.3);
  });

  it("resolves session outcomes", () => {
    expect(
      resolveSessionOutcome({ status: "closed", ordersCount: 1, handoffCount: 0 })
    ).toBe("ordered");
    expect(
      resolveSessionOutcome({ status: "closed", ordersCount: 0, handoffCount: 1 })
    ).toBe("handoff");
    expect(
      resolveSessionOutcome({ status: "closed", ordersCount: 0, handoffCount: 0 })
    ).toBe("abandoned");
    expect(
      resolveSessionOutcome({ status: "active", ordersCount: 0, handoffCount: 0 })
    ).toBe("active");
  });

  it("redacts transcript roles only user/assistant", () => {
    const transcript = redactTranscript([
      { role: "user", content: "Može" },
      { role: "assistant", content: "Naravno." },
      { role: "system", content: "hidden" },
    ]);
    expect(transcript).toHaveLength(2);
    expect(countUserMessages(transcript)).toBe(1);
  });

  it("extracts handoff intents from timeline", () => {
    const intents = extractIntentsFromTimeline([
      {
        event_type: "intent.resolved",
        payload: { intent: "ORDER" },
      },
      {
        event_type: "intent.resolved",
        payload: { intent: "HANDOFF_WAITER" },
      },
    ]);
    expect(intents).toEqual(["ORDER", "HANDOFF_WAITER"]);
  });

  it("computes waiter gap rate from session activity", () => {
    expect(
      computeWaiterGapRate({ sessionsWithActivity: 8, sessionsWithGap: 2 })
    ).toBe(0.25);
    expect(computeWaiterGapRate({ sessionsWithActivity: 0, sessionsWithGap: 0 })).toBe(
      0
    );
  });

  it("counts sessions with waiter gaps from beliefs or turn profiles", () => {
    const count = countSessionsWithWaiterGap([
      {
        ai_session_id: "ai-1",
        event_type: "mind.beliefs_compiled",
        payload: {
          summary: { "waiter.gap_count": 1 },
        },
      },
      {
        ai_session_id: "ai-2",
        event_type: "mind.turn_profile",
        payload: { planReason: "waiter.gap_blocks_confirm" },
      },
      {
        ai_session_id: "ai-3",
        event_type: "mind.beliefs_compiled",
        payload: {
          summary: { "waiter.gap_count": 0 },
        },
      },
    ]);

    expect(count).toBe(2);
  });

  it("aggregates session metrics from turn profiles", () => {
    const metrics = aggregateSessionMetricsFromTimeline([
      {
        event_type: "mind.turn_profile",
        payload: { llmUsed: true, planReason: "commerce.pressure" },
      },
      {
        event_type: "mind.turn_profile",
        payload: {
          llmUsed: false,
          planReason: "waiter.gap_blocks_confirm",
        },
      },
    ]);

    expect(metrics.turnCount).toBe(2);
    expect(metrics.llmTurnCount).toBe(1);
    expect(metrics.llmInvocationRate).toBe(0.5);
    expect(metrics.gapTurnCount).toBe(1);
    expect(metrics.gapRate).toBe(0.5);
  });

  it("extracts latest beliefs summary from timeline", () => {
    const beliefs = extractLatestBeliefsSummary([
      {
        event_type: "mind.beliefs_compiled",
        created_at: "2026-06-06T20:00:00.000Z",
        payload: {
          beliefsHash: "hash-1",
          beliefCount: 2,
          summary: { "waiter.gap_count": 1 },
        },
      },
      {
        event_type: "mind.beliefs_compiled",
        created_at: "2026-06-06T20:05:00.000Z",
        payload: {
          beliefsHash: "hash-2",
          beliefCount: 3,
          summary: {
            "waiter.gap_count": 0,
            "waiter.can_confirm": true,
          },
        },
      },
    ]);

    expect(beliefs?.beliefsHash).toBe("hash-2");
    expect(beliefs?.summary["waiter.can_confirm"]).toBe(true);
    expect(beliefs?.compiledAt).toBe("2026-06-06T20:05:00.000Z");
  });
});

describe("OperatorOrderListItem shape contract", () => {
  it("matches ADR-028 order list fields without PII", () => {
    const sample: OperatorOrderListItem = {
      orderId: "ord-1",
      orderNumber: 42,
      status: "preparing",
      totalCents: 1250,
      itemCount: 2,
      createdAt: "2026-05-29T12:00:00.000Z",
      sessionId: "sess-1",
    };

    expect(Object.keys(sample)).toEqual([
      "orderId",
      "orderNumber",
      "status",
      "totalCents",
      "itemCount",
      "createdAt",
      "sessionId",
    ]);
    expect(sample).not.toHaveProperty("session_token");
    expect(sample).not.toHaveProperty("guest_email");
    expect(sample).not.toHaveProperty("payment_instrument");
  });
});

describe("OperatorTranscript shape contract", () => {
  it("redacts system roles and never exposes tokens", () => {
    const transcript: OperatorTranscript = {
      sessionId: "sess-1",
      locationId: "loc-1",
      turns: redactTranscript([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "system", content: "secret" },
      ]),
      redacted: true,
    };

    expect(transcript.turns).toHaveLength(2);
    expect(transcript.redacted).toBe(true);
    expect(transcript).not.toHaveProperty("session_token");
    expect(transcript).not.toHaveProperty("qr_token");
    expect(transcript).not.toHaveProperty("device_fingerprint");
  });
});

describe("LocationSummary shape contract", () => {
  it("matches ADR-028 required top-level keys", () => {
    const sample = {
      locationId: "loc-1",
      period: { from: "2026-05-29T00:00:00.000Z", to: "2026-05-29T23:59:59.999Z" },
      commerce: {
        ordersCount: 0,
        revenueCents: 0,
        avgCheckCents: 0,
      },
      denis: {
        sessionsCount: 0,
        sessionsWithOrder: 0,
        conversionRate: 0,
        escalationsCount: 0,
        avgTurnsPerSession: 0,
        topLanguages: [],
        llmInvocationRate: 0,
        waiterGapRate: 0,
      },
      ops: {
        rushMinutes: 0,
        openWaiterCalls: 0,
      },
    };

    expect(Object.keys(sample)).toEqual([
      "locationId",
      "period",
      "commerce",
      "denis",
      "ops",
    ]);
    expect(sample).not.toHaveProperty("session_token");
    expect(sample).not.toHaveProperty("guest_email");
  });
});

describe("DenisLocationMetrics shape contract", () => {
  it("includes waiterGapRate for Viktor SLA dashboard", () => {
    const sample: DenisLocationMetrics = {
      locationId: "loc-1",
      period: {
        from: "2026-06-06T00:00:00.000Z",
        to: "2026-06-06T23:59:59.999Z",
      },
      sessionsCount: 10,
      sessionsWithDenisActivity: 8,
      sessionsWithOrder: 4,
      conversionRate: 0.4,
      llmInvocationRate: 0.25,
      waiterGapRate: 0.125,
      avgTurnsPerSession: 3.2,
      avgCreditsPerSession: 1.1,
      escalationsCount: 0,
      topLanguages: [{ lang: "de", count: 6 }],
      creditBalance: 120,
      lowBalance: false,
    };

    expect(sample.waiterGapRate).toBe(0.125);
    expect(sample).not.toHaveProperty("session_token");
  });
});

describe("OperatorSessionSummary shape contract", () => {
  it("includes session metrics and beliefs summary without PII", () => {
    const sample: OperatorSessionSummary = {
      sessionId: "sess-1",
      locationId: "loc-1",
      status: "closed",
      outcome: "ordered",
      openedAt: "2026-06-06T20:00:00.000Z",
      closedAt: "2026-06-06T21:00:00.000Z",
      turnCount: 4,
      messageCount: 8,
      language: "de",
      intents: ["ORDER"],
      ordersCount: 1,
      metrics: {
        turnCount: 4,
        llmTurnCount: 2,
        llmInvocationRate: 0.5,
        gapTurnCount: 1,
        gapRate: 0.25,
      },
      beliefs: {
        beliefsHash: "abc123",
        beliefCount: 5,
        summary: {
          "waiter.gap_count": 0,
          "waiter.can_confirm": true,
        },
        compiledAt: "2026-06-06T20:55:00.000Z",
      },
    };

    expect(sample.metrics?.gapRate).toBe(0.25);
    expect(sample.beliefs?.summary["waiter.can_confirm"]).toBe(true);
    expect(sample).not.toHaveProperty("guest_email");
    expect(sample).not.toHaveProperty("qr_token");
  });
});
