import { describe, expect, it } from "vitest";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  buildActiveMemory,
  buildSemanticKeyFacts,
  formatActiveMemoryBlock,
} from "@/lib/denis/cognition/conversation/active-memory";
import {
  CONTEXT_BUDGET_BY_COMPLEXITY,
  estimateContextTokens,
  estimateTurnComplexity,
  resolveAdaptiveContextBudget,
  resolveIncludedPriorities,
  scoreContextFreshness,
} from "@/lib/denis/cognition/context/context-budget";
import {
  assembleContextLayers,
  createContextLayer,
  filterLayersForIntent,
  inferTurnIntent,
} from "@/lib/denis/cognition/context/priority-layers";
import { buildInterpretationTask } from "@/lib/denis/cognition/tde/build-interpretation-task";
import { belief, beliefGraph } from "@/lib/denis/cognition/tde";
import { normalizeTurnInterpretation } from "@/lib/denis/cognition/tde/extract-turn-interpretation";

function guestRow(seq: number, text: string, ageMs = seq * 1000): DenisTimelineRow {
  const interpretation = normalizeTurnInterpretation({
    sentiment: "neutral",
    mealStage: "ordering",
    modifications: [],
    preferences: /bez luka/i.test(text) ? ["bez luka"] : [],
    followUpMinutes: null,
    partySize: null,
    awaiting: null,
    askedDessert: /\bdesert\b/i.test(text),
    sidePreference: /pomfrit/i.test(text) ? "pomfrit" : null,
    cookingPreference: /medium rare/i.test(text) ? "medium rare" : null,
    agreedOrderLine: /burger/i.test(text) ? "burger" : null,
    guestReferenceKind: null,
    guestReferenceDetail: null,
  });

  return {
    id: `guest-${seq}`,
    ai_session_id: "sess-1",
    seq,
    event_type: "perception.ingested",
    payload: {
      type: "perception.ingested",
      frame: {
        channel: "chat.message",
        normalizedText: text,
        structuredIntent: null,
        ingestedAt: new Date(Date.now() - ageMs).toISOString(),
        interpretation,
      },
      envelope: { traceId: "t1", surface: "chat" },
      interpretation,
      turnInterpretation: interpretation,
    },
    trace_id: null,
    context_hash: null,
    created_at: new Date(Date.now() - ageMs).toISOString(),
  };
}

function tellRow(seq: number, message: string, ageMs = seq * 1000): DenisTimelineRow {
  return {
    id: `tell-${seq}`,
    ai_session_id: "sess-1",
    seq,
    event_type: "tell.committed",
    payload: { type: "tell.committed", message, tier: "template" },
    trace_id: null,
    context_hash: null,
    created_at: new Date(Date.now() - ageMs).toISOString(),
  };
}

function buildBurgerSessionTimeline(): DenisTimelineRow[] {
  const script: Array<{ role: "guest" | "denis"; text: string }> = [
    { role: "guest", text: "Dobar dan" },
    { role: "denis", text: "Dobar dan!" },
    { role: "guest", text: "Burger bez luka, medium rare, sa pomfritom" },
    { role: "denis", text: "Odlično — jedan burger bez luka medium rare sa pomfritom." },
    { role: "guest", text: "Imate veganske opcije?" },
    { role: "denis", text: "Imamo salatu i wrap." },
    { role: "guest", text: "Hmm možda kasnije" },
    { role: "denis", text: "Naravno." },
    { role: "guest", text: "Daj mi i pivo" },
    { role: "denis", text: "Koju veličinu?" },
    { role: "guest", text: "0.5" },
    { role: "denis", text: "Dodao sam pivo." },
    { role: "guest", text: "Ne hvala" },
    { role: "denis", text: "Super — potvrđujem burger i pivo?" },
    { role: "guest", text: "Da" },
    { role: "denis", text: "Potvrđeno!" },
    { role: "guest", text: "Koliko traje?" },
    { role: "denis", text: "Oko 15 minuta." },
    { role: "guest", text: "Ok hvala" },
    { role: "denis", text: "Nema na čemu!" },
    { role: "guest", text: "A desert?" },
    { role: "denis", text: "Imamo tortu i palačinke." },
  ];

  return script.map((entry, index) =>
    entry.role === "guest"
      ? guestRow(index + 1, entry.text, (script.length - index) * 30_000)
      : tellRow(index + 1, entry.text, (script.length - index) * 30_000)
  );
}

describe("semantic compression (11→2)", () => {
  it("compresses 20+ turns to ~40 tokens with zero info loss on key facts", () => {
    const timeline = buildBurgerSessionTimeline();
    expect(timeline.length).toBeGreaterThanOrEqual(20);

    const memory = buildActiveMemory(timeline);
    expect(memory).not.toBeNull();

    const block = formatActiveMemoryBlock(memory!);
    const compressedTokens = estimateContextTokens(block);

    expect(compressedTokens).toBeLessThanOrEqual(80);
    expect(memory!.tokensSaved).toBeGreaterThan(50);
    expect(memory!.keyFacts.length).toBeLessThanOrEqual(5);
    expect(memory!.keyFacts.length).toBeGreaterThan(0);

    const joined = [
      memory!.semanticSummary,
      ...memory!.keyFacts,
      ...memory!.guestPreferences,
    ]
      .join(" ")
      .toLowerCase();

    expect(joined).toMatch(/bez luka/);
    expect(joined).toMatch(/medium rare/);
    expect(joined).toMatch(/pomfrit/);
    expect(joined).toMatch(/desert/);
  });

  it("buildSemanticKeyFacts produces narrative compression line", () => {
    const messages = [
      { role: "guest" as const, text: "Burger bez luka, medium rare, sa pomfritom" },
      { role: "denis" as const, text: "Odlično!" },
      { role: "guest" as const, text: "A desert?" },
    ];
    const timeline = [
      guestRow(1, "Burger bez luka, medium rare, sa pomfritom"),
      guestRow(2, "A desert?"),
    ];

    const { keyFacts, semanticSummary } = buildSemanticKeyFacts({
      messages,
      timeline,
      preferences: ["bez luka"],
      agreedFacts: [],
      openQuestions: [],
    });

    expect(keyFacts.length).toBeLessThanOrEqual(5);
    expect(semanticSummary.toLowerCase()).toMatch(/burger/);
    expect(semanticSummary.toLowerCase()).toMatch(/bez luka/);
    expect(semanticSummary.toLowerCase()).toMatch(/desert/);
  });
});

describe("adaptive context budget", () => {
  it("simple turn (da) → 500 token budget", () => {
    const budget = resolveAdaptiveContextBudget({
      guestMessage: "da",
      maxContextTokens: 4000,
      adaptiveEnabled: true,
    });
    expect(budget.complexity).toBe("simple");
    expect(budget.tokenBudget).toBe(CONTEXT_BUDGET_BY_COMPLEXITY.simple);
    expect(budget.tokenBudget).toBe(500);
  });

  it("complex group order → 4000 token budget", () => {
    const budget = resolveAdaptiveContextBudget({
      guestMessage: "Group order za cijeli stol — 4 burgera, 2 piva, 1 salata",
      maxContextTokens: 4000,
      adaptiveEnabled: true,
    });
    expect(budget.complexity).toBe("complex");
    expect(budget.tokenBudget).toBe(4000);
  });

  it("buildInterpretationTask attaches adaptive budget", () => {
    const task = buildInterpretationTask(
      { type: "COMPLETE_ROUND", priority: 90 },
      beliefGraph([belief("conversation.mode", "ordering")]),
      { guestMessage: "da", maxContextTokens: 4000, adaptiveContext: true }
    );
    expect(task?.evidenceBudget.contextTokenBudget).toBe(500);
    expect(task?.evidenceBudget.turnComplexity).toBe("simple");
  });
});

describe("context freshness scoring", () => {
  it("≤2 min → freshness 1.0", () => {
    expect(scoreContextFreshness(60_000)).toBe(1.0);
    expect(scoreContextFreshness(120_000)).toBe(1.0);
  });

  it("≥10 min → freshness 0.5", () => {
    expect(scoreContextFreshness(600_000)).toBe(0.5);
    expect(scoreContextFreshness(900_000)).toBe(0.5);
  });

  it("stale session compresses tail more aggressively", () => {
    const freshTimeline = buildBurgerSessionTimeline().map((row, index) => ({
      ...row,
      created_at: new Date(Date.now() - index * 1000).toISOString(),
    }));
    const staleTimeline = buildBurgerSessionTimeline().map((row, index) => ({
      ...row,
      created_at: new Date(Date.now() - index * 600_000).toISOString(),
    }));

    const fresh = buildActiveMemory(freshTimeline)!;
    const stale = buildActiveMemory(staleTimeline)!;

    expect(fresh.rawTail.length).toBeGreaterThan(stale.rawTail.length);
    expect(stale.avgFreshness).toBeLessThan(fresh.avgFreshness);
  });
});

describe("priority layers", () => {
  it("budget 2000 includes P0+P1+P2", () => {
    expect(resolveIncludedPriorities(2000)).toEqual(["P0", "P1", "P2"]);
  });

  it("budget 1000 includes P0+P1 only", () => {
    expect(resolveIncludedPriorities(1000)).toEqual(["P0", "P1"]);
  });

  it("assembles P0 before P2 within budget", () => {
    const layers = [
      createContextLayer("P2", "venue_ops", "VENUE OPS:\n- rush")!,
      createContextLayer("P0", "cart", "VISIBLE CART:\n- burger x1")!,
      createContextLayer("P1", "recent_turns", "RECENT:\nGuest: da")!,
    ];

    const assembled = assembleContextLayers({
      layers,
      tokenBudget: 200,
      intent: "ordering",
      guestMessage: "daj burger",
    });

    expect(assembled.included.some((layer) => layer.id === "cart")).toBe(true);
    expect(assembled.prioritiesIncluded).toContain("P0");
  });

  it("zero-waste: price inquiry skips browse history", () => {
    const layers = [
      createContextLayer("P0", "cart", "CART")!,
      createContextLayer("P2", "scroll", "SCROLL INTEL")!,
      createContextLayer("P3", "analytics", "ANALYTICS")!,
    ];

    const filtered = filterLayersForIntent(layers, "price_inquiry", "Koliko košta burger?");
    expect(filtered.some((layer) => layer.id === "scroll")).toBe(false);
    expect(filtered.some((layer) => layer.id === "analytics")).toBe(false);
  });

  it("zero-waste: ordering skips browse history", () => {
    expect(inferTurnIntent("Daj mi burger")).toBe("ordering");
    const layers = [
      createContextLayer("P2", "scroll", "SCROLL")!,
      createContextLayer("P0", "cart", "CART")!,
    ];
    const filtered = filterLayersForIntent(layers, "ordering", "Daj mi burger");
    expect(filtered.some((layer) => layer.id === "scroll")).toBe(false);
  });

  it("estimateTurnComplexity classifies simple ack", () => {
    expect(estimateTurnComplexity("da")).toBe("simple");
    expect(estimateTurnComplexity("Group order za sve")).toBe("complex");
  });
});
