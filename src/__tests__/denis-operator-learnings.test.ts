import { describe, expect, it, vi } from "vitest";
import { aggregateLocationLearnings } from "@/lib/denis/learning/aggregate-location-learnings";
import { detectTurnLearningSignals } from "@/lib/denis/platform/detect-turn-learning-signals";
import { emitTurnLearningEvents } from "@/lib/denis/platform/emit-turn-learning-events";
import * as appendTimeline from "@/lib/denis/platform/append-timeline-event";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

describe("detectTurnLearningSignals", () => {
  const menu = ["Pilsner 0.5L", "Schnitzel", "Cola"];

  it("emits menu_gap when guest asks for off-menu mojito", () => {
    const signals = detectTurnLearningSignals({
      guestMessage: "Imate li mojito?",
      legacyIntent: "chat",
      guestIntent: "BROWSE",
      productNames: menu,
      cartChanged: false,
      orderSubmitted: false,
    });

    expect(signals.some((row) => row.kind === "menu_gap")).toBe(true);
    expect(signals.find((row) => row.kind === "menu_gap")).toMatchObject({
      term: "mojito",
    });
  });

  it("emits price_resistance when guest asks price and does not order", () => {
    const signals = detectTurnLearningSignals({
      guestMessage: "Koliko košta Schnitzel?",
      legacyIntent: "chat",
      guestIntent: "BROWSE",
      productNames: menu,
      cartChanged: false,
      orderSubmitted: false,
    });

    expect(signals.some((row) => row.kind === "price_resistance")).toBe(true);
  });
});

describe("emitTurnLearningEvents", () => {
  it("writes learning.menu_gap timeline event", async () => {
    const append = vi
      .spyOn(appendTimeline, "appendDenisTimelineEvent")
      .mockResolvedValue(null);

    await emitTurnLearningEvents({} as never, {
      aiSessionId: "sess-1",
      traceId: "trace-1",
      locationId: "loc-1",
      detectInput: {
        guestMessage: "Imate li mojito?",
        legacyIntent: "chat",
        guestIntent: "BROWSE",
        productNames: ["Pilsner"],
        cartChanged: false,
        orderSubmitted: false,
      },
    });

    expect(append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "learning.menu_gap",
        aiSessionId: "sess-1",
        traceId: "trace-1",
      })
    );

    append.mockRestore();
  });
});

describe("aggregateLocationLearnings", () => {
  function menuGapRow(term: string, createdAt: string): DenisTimelineRow {
    return {
      id: `${term}-${createdAt}`,
      ai_session_id: "s1",
      seq: 1,
      event_type: "learning.menu_gap",
      trace_id: "t1",
      context_hash: null,
      created_at: createdAt,
      payload: {
        type: "learning.menu_gap",
        term,
        guestMessage: `Imate li ${term}?`,
        locationId: "loc-1",
        capturedAt: createdAt,
      },
    };
  }

  it("flags menu_gap suggestion after 5+ requests for same term", () => {
    const timeline = Array.from({ length: 5 }, (_, index) =>
      menuGapRow("mojito", `2026-06-0${index + 1}T12:00:00.000Z`)
    );

    const result = aggregateLocationLearnings({ timeline });

    expect(result.menuGap).toHaveLength(1);
    expect(result.menuGap[0]).toMatchObject({
      term: "mojito",
      count: 5,
      suggestMenuAdd: true,
    });
  });

  it("aggregates price_resistance count", () => {
    const timeline: DenisTimelineRow[] = [
      {
        id: "1",
        ai_session_id: "s1",
        seq: 1,
        event_type: "learning.price_resistance",
        trace_id: "t1",
        context_hash: null,
        created_at: "2026-06-07T12:00:00.000Z",
        payload: {
          type: "learning.price_resistance",
          guestMessage: "Koliko košta burger?",
          productHint: "Burger",
          locationId: "loc-1",
          capturedAt: "2026-06-07T12:00:00.000Z",
        },
      },
    ];

    const result = aggregateLocationLearnings({ timeline });
    expect(result.priceResistance.count).toBe(1);
  });
});
