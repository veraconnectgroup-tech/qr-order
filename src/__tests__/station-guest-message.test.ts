import { describe, expect, it } from "vitest";
import type { OrderFact } from "@/lib/denis/loop/types";
import {
  buildStationAwareOrderStatusMessage,
  messageContainsInventedEta,
} from "@/lib/guest/station-guest-message";

function order(overrides: Partial<OrderFact> = {}): OrderFact {
  return {
    id: "order-1",
    orderNumber: 12,
    status: "preparing",
    paymentStatus: "paid",
    estimatedPrepMinutes: 15,
    createdAt: "2026-07-01T18:00:00.000Z",
    items: [
      {
        productName: "Burger",
        quantity: 1,
        menuSection: "food",
      },
      {
        productName: "Cola",
        quantity: 1,
        menuSection: "drinks",
      },
    ],
    stationStates: [
      { station: "kitchen", status: "in_prep", readyAt: null, pickedUpAt: null },
      { station: "bar", status: "ready", readyAt: "2026-07-01T18:05:00.000Z", pickedUpAt: null },
    ],
    ...overrides,
  };
}

describe("buildStationAwareOrderStatusMessage (truth contract)", () => {
  it("returns bar-ready + kitchen-in_prep message for mixed orders", () => {
    const message = buildStationAwareOrderStatusMessage({
      order: order(),
      language: "sr",
    });

    expect(message).toContain("piće je spremno");
    expect(message).toContain("hrana se još priprema");
    expect(message).not.toMatch(/sve je spremno/i);
  });

  it("does not invent minute counts without fresh station ETA", () => {
    const message = buildStationAwareOrderStatusMessage({
      order: order(),
      language: "en",
    });

    expect(message).not.toBeNull();
    expect(messageContainsInventedEta(message!)).toBe(false);
  });

  it("allows minutes only from fresh station ETA answer", () => {
    const message = buildStationAwareOrderStatusMessage({
      order: order({ stationStates: [
        { station: "kitchen", status: "in_prep", readyAt: null, pickedUpAt: null },
      ], items: [{ productName: "Burger", quantity: 1, menuSection: "food" }] }),
      language: "sr",
      freshEta: {
        answer: "eta",
        etaMinutes: 8,
        station: "kitchen",
        answeredAt: new Date().toISOString(),
        ageMinutes: 1,
      },
    });

    expect(message).toMatch(/\d+\s*min/i);
  });

  it('uses "all ready" only when every active station is ready+', () => {
    const message = buildStationAwareOrderStatusMessage({
      order: order({
        stationStates: [
          { station: "kitchen", status: "ready", readyAt: "2026-07-01T18:10:00.000Z", pickedUpAt: null },
          { station: "bar", status: "ready", readyAt: "2026-07-01T18:05:00.000Z", pickedUpAt: null },
        ],
      }),
      language: "sr",
    });

    expect(message).toMatch(/sve je spremno/i);
  });

  it("does not call queued status in prep", () => {
    const message = buildStationAwareOrderStatusMessage({
      order: order({
        status: "accepted",
        items: [{ productName: "Burger", quantity: 1, menuSection: "food" }],
        stationStates: [
          { station: "kitchen", status: "queued", readyAt: null, pickedUpAt: null },
        ],
      }),
      language: "sr",
    });

    expect(message).toMatch(/primljena|čeka početak/i);
    expect(message).not.toMatch(/priprema vašu hranu/i);
  });

  it("falls back to null when no station states exist", () => {
    const message = buildStationAwareOrderStatusMessage({
      order: order({ stationStates: undefined }),
      language: "sr",
    });

    expect(message).toBeNull();
  });
});

describe("openOrderStatusGuestMessage integration", () => {
  it("uses station-aware message when station data exists", async () => {
    const { openOrderStatusGuestMessage } = await import(
      "@/lib/guest/denis-guest-recovery"
    );

    const message = openOrderStatusGuestMessage([order()], "sr");
    expect(message).toContain("piće je spremno");
  });
});
