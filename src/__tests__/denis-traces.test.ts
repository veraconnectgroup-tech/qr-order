import { describe, expect, it } from "vitest";
import { buildTurnTrace } from "@/lib/denis/runtime/turn-trace";
import { ERROR_CODES } from "@/lib/api-error-client";

describe("denis-traces API contract", () => {
  it("maps trace rows to inspector-friendly shape", () => {
    const trace = buildTurnTrace({
      traceId: "t-1",
      aiSessionId: "sess-abc",
      locationId: "loc-1",
      guestInput: "Ein Bier bitte",
      language: "de",
      orgId: "org-1",
      creditsRemaining: 10,
      contextMs: 5,
      legacyMs: 0,
      actMs: 3,
      narrateMs: 12,
      totalMs: 20,
      tier: "t0",
      planKind: "reflex",
      llmUsed: false,
      cartActionCount: 1,
      submitTriggered: false,
      obligationFired: false,
      denisResponse: "Ein Bier — kommt sofort.",
      quickReplies: [],
    });

    const row = {
      trace_id: trace.traceId,
      created_at: trace.timestamp,
      total_duration_ms: trace.totalDurationMs,
      tier: trace.phases.plan.tier,
      llm_used: trace.phases.perceive.llmUsed,
      total_tokens: trace.totalTokens,
      trace_data: trace,
    };

    const mapped = {
      ...(row.trace_data ?? {}),
      traceId: row.trace_id,
      totalDurationMs: row.total_duration_ms ?? row.trace_data?.totalDurationMs ?? 0,
      totalTokens: row.total_tokens ?? row.trace_data?.totalTokens ?? 0,
    };

    expect(mapped.guestInput).toBe("Ein Bier bitte");
    expect(mapped.phases.act.cartActions).toBe(1);
    expect(mapped.traceId).toBe("t-1");
  });
});

describe("unified error codes for guest chat", () => {
  it("includes moderation and rate limit codes", () => {
    expect(ERROR_CODES.MODERATION_BLOCKED).toBe("moderation_blocked");
    expect(ERROR_CODES.RATE_LIMITED).toBe("rate_limited");
    expect(ERROR_CODES.CIRCUIT_OPEN).toBe("circuit_open");
  });
});
