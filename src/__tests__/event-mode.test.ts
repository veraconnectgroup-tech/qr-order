import { describe, expect, it } from "vitest";
import { deriveOpsPlannerEffects } from "@/lib/denis/venue/ops/planner-effects";
import {
  buildEventCopilotLines,
  detectEventGathering,
  formatPresetMenuDecline,
  parseEventConfig,
  presetMenuBlockedProductNames,
  resolveEventEffects,
  resolveEventPhase,
  shouldAllowEventProactiveNudge,
  shouldBatchTableOrders,
} from "@/lib/denis/venue/ops/event-mode";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { applyEventModeConfigOverlay } from "@/lib/denis/config/resolve-effective-config";
import { buildNarrationFacts } from "@/lib/denis/runtime/narrate/build-narration-facts";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

const EVENT_NOW = Date.parse("2026-06-07T20:30:00.000Z");

const sampleEvent = {
  name: "Rođendan Marka",
  expectedGuests: 30,
  presetMenu: true,
  presetProductIds: [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ],
  startTime: "2026-06-07T18:00:00.000Z",
  endTime: "2026-06-07T23:00:00.000Z",
  specialInstructions: "Torta dolazi u 21h",
  cakeAt: "21:00",
};

const eventOps: VenueOpsBeliefs = {
  operatingMode: "event",
  kdsStress: "normal",
  acceptingOrders: true,
  unavailableProductIds: [],
  staffHint: null,
  eventConfig: sampleEvent,
};

function minimalReflexTurn(
  draftItems: Array<{ productId: string; productName: string }>
): ReflexTurnResult {
  return {
    reflex: null,
    correction: null,
    conflict: null,
    plan: {
      transition: {
        fromNodeId: "collect",
        toNodeId: "collect",
        signal: "ORDER",
        skippedGuard: false,
      },
      flowNode: {
        nodeId: "collect",
        skills: [],
        narrateTemplate: null,
        guard: null,
      },
      goals: [],
      topGoal: { type: "GUEST_SEATED", priority: 10 },
      skills: [],
      primarySignal: "ORDER",
    },
    cartState: {
      ...emptyCartState(),
      draft: {
        items: draftItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 10,
        })),
        cartRevision: 1,
      },
    },
    usedT0: false,
    handoffCommand: null,
    handoffPaymentMethod: null,
    pipelineHints: {
      reflexIntent: null,
      handoffIntent: null,
      feedsPipeline: true,
    },
  };
}

describe("event mode (N3)", () => {
  it("parses event config from JSON", () => {
    const config = parseEventConfig(sampleEvent);
    expect(config?.name).toBe("Rođendan Marka");
    expect(config?.presetMenu).toBe(true);
  });

  it("resolveEventPhase during active window", () => {
    expect(resolveEventPhase(sampleEvent, EVENT_NOW)).toBe("during");
  });

  it("during event skips upsell and enables batch ordering", () => {
    const effects = resolveEventEffects(
      sampleEvent,
      "during",
      Date.parse("2026-06-07T20:00:00.000Z")
    );
    expect(effects.skipUpsell).toBe(true);
    expect(effects.batchOrderEnabled).toBe(true);
    expect(effects.shortenReplies).toBe(true);
    expect(effects.presetMenuOnly).toBe(true);
    expect(effects.suppressProactiveNudges).toBe(true);
    expect(effects.drinkPromptOnly).toBe(true);
  });

  it("pauses all nudges 10 minutes before cake", () => {
    const effects = resolveEventEffects(
      sampleEvent,
      "during",
      Date.parse("2026-06-07T20:55:00.000Z")
    );
    expect(effects.suppressProactiveNudges).toBe(true);
    expect(effects.drinkPromptOnly).toBe(false);
  });

  it("post-event enables group bill split", () => {
    const effects = resolveEventEffects(sampleEvent, "winding_down", EVENT_NOW);
    expect(effects.groupBillEnabled).toBe(true);
  });

  it("deriveOpsPlannerEffects applies event overlay", () => {
    const fx = deriveOpsPlannerEffects(eventOps, CONCIERGE_PLATFORM_DEFAULTS);
    expect(fx.skipUpsell).toBe(true);
    expect(fx.presetMenuOnly).toBe(true);
    expect(fx.presetProductIds).toHaveLength(2);
    expect(fx.suppressProactiveNudges).toBe(true);
  });

  it("applyEventModeConfigOverlay disables upsell during event", () => {
    const baseConfig = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, null);
    const effective = applyEventModeConfigOverlay(baseConfig, eventOps);
    expect(effective.upsell.maxUpsellsPerSession).toBe(0);
    expect(effective.upsell.dessertAfterDelivered).toBe(false);
    expect(effective.persona.maxWordsPerReply).toBeLessThanOrEqual(25);
  });

  it("guest message with off-menu draft gets preset menu decline", () => {
    const opsEffects = deriveOpsPlannerEffects(eventOps, CONCIERGE_PLATFORM_DEFAULTS);
    const facts = buildNarrationFacts({
      config: mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, null),
      language: "sr",
      reflexTurn: minimalReflexTurn([
        {
          productId: "33333333-3333-4333-8333-333333333333",
          productName: "Off-menu Steak",
        },
      ]),
      opsEffects,
    });
    expect(facts.committed.blockedReason?.toLowerCase()).toContain("poseban meni");
  });

  it("preset menu decline does not mention event name", () => {
    const message = formatPresetMenuDecline({
      productName: "Sushi Platter",
      language: "sr",
    });
    expect(message.toLowerCase()).toContain("poseban meni");
    expect(message.toLowerCase()).not.toContain("rođendan");
    expect(message).toContain("Sushi Platter");
  });

  it("blocks off-menu draft items when presetMenuOnly", () => {
    const blocked = presetMenuBlockedProductNames({
      draftItems: [
        {
          productId: "33333333-3333-4333-8333-333333333333",
          productName: "Off-menu Steak",
        },
      ],
      presetMenuOnly: true,
      presetProductIds: sampleEvent.presetProductIds,
    });
    expect(blocked).toEqual(["Off-menu Steak"]);
  });

  it("detects group gathering at 5 scans in 10 minutes", () => {
    const opens = Array.from({ length: 5 }, (_, index) => ({
      at: new Date(EVENT_NOW - index * 60_000).toISOString(),
    }));
    const detection = detectEventGathering({
      recentSessionOpens: opens,
      nowMs: EVENT_NOW,
    });
    expect(detection.isGathering).toBe(true);
    expect(detection.scanCount).toBe(5);
    expect(detection.windowMinutes).toBe(10);
  });

  it("allows only service nudges during event", () => {
    expect(
      shouldAllowEventProactiveNudge("dessert_nudge", {
        suppressProactiveNudges: true,
        drinkPromptOnly: true,
      })
    ).toBe(false);
    expect(
      shouldAllowEventProactiveNudge("drink_refill", {
        suppressProactiveNudges: true,
        drinkPromptOnly: true,
      })
    ).toBe(true);
  });

  it("builds staff copilot event lines", () => {
    const lines = buildEventCopilotLines({
      event: sampleEvent,
      effects: resolveEventEffects(sampleEvent, "during", EVENT_NOW),
      stats: {
        orderedGuestCount: 24,
        activeSessionCount: 30,
        tablesWithoutOrder: 6,
        topProducts: [
          { name: "Pivo", count: 18 },
          { name: "Burger", count: 22 },
        ],
      },
      nowMs: EVENT_NOW,
    });
    expect(lines[0]).toContain("EVENT MODE");
    expect(lines.some((line) => line.includes("24/30"))).toBe(true);
    expect(lines.some((line) => line.includes("Pivo"))).toBe(true);
    expect(lines.some((line) => line.includes("bez narudžbe"))).toBe(true);
  });

  it("batch orders when 3+ open orders on table in event mode", () => {
    const effects = resolveEventEffects(sampleEvent, "during", EVENT_NOW);
    expect(shouldBatchTableOrders(3, effects)).toBe(true);
    expect(shouldBatchTableOrders(2, effects)).toBe(false);
  });
});
