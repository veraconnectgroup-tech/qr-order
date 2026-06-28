import { describe, expect, it } from "vitest";
import {
  classifyGuestIntent,
  INTENT_ROUTER_AB_FIXTURES,
  isGuestSettlingMessage,
  isGuestVagueBrowseMessage,
  runIntentRouterAbEval,
  SemanticIntentCache,
} from "@/lib/denis/cognition/tde/semantic-intent-router";

describe("semantic-intent-router", () => {
  it("ma daj → browse (not smalltalk)", () => {
    const result = classifyGuestIntent("ma daj");
    expect(result.intent).toBe("browse");
    expect(result.tier).toBe("T1");
    expect(result.intent).not.toBe("smalltalk");
  });

  it("ajde racun → settling", () => {
    expect(classifyGuestIntent("ajde racun").intent).toBe("settling");
    expect(isGuestSettlingMessage("ajde racun")).toBe(true);
  });

  it("T0 confirm/decline/clarify are instant", () => {
    expect(classifyGuestIntent("da")).toEqual(
      expect.objectContaining({ intent: "confirm", tier: "T0", confidence: 1 })
    );
    expect(classifyGuestIntent("ne")).toEqual(
      expect.objectContaining({ intent: "decline", tier: "T0", confidence: 1 })
    );
    expect(classifyGuestIntent("2")).toEqual(
      expect.objectContaining({ intent: "clarify_reply", tier: "T0", confidence: 1 })
    );
  });

  it("mixed language phrases route to correct cluster", () => {
    expect(classifyGuestIntent("bestell ein bier").intent).toBe("order");
    expect(classifyGuestIntent("hallo wie gehts").intent).toBe("smalltalk");
    expect(classifyGuestIntent("wo ist mein bier").intent).toBe("status");
    expect(classifyGuestIntent("what do you have").intent).toBe("browse");
    expect(isGuestVagueBrowseMessage("preporuči mi nešto")).toBe(true);
  });

  it("cache hit returns same intent in <1ms", () => {
    const cache = new SemanticIntentCache({ maxSize: 1000 });
    classifyGuestIntent("ma daj nešto", { cache });
    expect(cache.size).toBe(1);

    const start = performance.now();
    const hit = classifyGuestIntent("ma daj nešto", { cache });
    const elapsed = performance.now() - start;

    expect(hit.intent).toBe("browse");
    expect(hit.cacheKey).toBeDefined();
    expect(elapsed).toBeLessThan(1);
  });

  it("A/B eval: semantic router ≥ regex accuracy", () => {
    const report = runIntentRouterAbEval(INTENT_ROUTER_AB_FIXTURES);
    expect(report.semanticAccuracy).toBeGreaterThanOrEqual(report.regexAccuracy);
    expect(report.semanticAccuracy).toBeGreaterThanOrEqual(0.9);
    expect(report.t0Rate + report.t1Rate + report.t2Rate).toBeCloseTo(1, 5);
    expect(report.ok).toBe(true);
  });
});
