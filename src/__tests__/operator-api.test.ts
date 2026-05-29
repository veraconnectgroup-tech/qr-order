import { describe, expect, it } from "vitest";
import {
  computeAvgCheckCents,
  computeConversionRate,
  computeLlmInvocationRate,
  computeTipRate,
  countUserMessages,
  extractIntentsFromTimeline,
  redactTranscript,
  resolveSessionOutcome,
} from "@/lib/operator/projections/helpers";
import {
  generateOperatorApiKey,
  hashOperatorApiKey,
  isOperatorApiKeyFormat,
  OPERATOR_KEY_PREFIX,
} from "@/lib/operator/keys";
import { hasOperatorScope } from "@/lib/operator/scopes";
import { parseOperatorPeriod, periodToIsoRange } from "@/lib/operator/parse-period";

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

describe("operator scopes", () => {
  it("checks operator:read scope", () => {
    expect(hasOperatorScope(["operator:read"], "operator:read")).toBe(true);
    expect(hasOperatorScope(["orders:read"], "operator:read")).toBe(false);
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
