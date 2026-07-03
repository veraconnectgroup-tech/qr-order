import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { OrderFact } from "@/lib/denis/loop/types";
import { resolveGuestStatusIntel } from "@/lib/denis/stations/resolve-guest-status-intel";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

const NOW = Date.parse("2026-07-01T18:10:00.000Z");
const config = CONCIERGE_PLATFORM_DEFAULTS;

function drinkOrder(overrides: Partial<OrderFact> = {}): OrderFact {
  return {
    id: "order-1",
    orderNumber: 4,
    status: "accepted",
    paymentStatus: "paid",
    estimatedPrepMinutes: null,
    createdAt: "2026-07-01T18:09:30.000Z",
    items: [{ productName: "Pivo", quantity: 1, menuSection: "drinks" }],
    stationStates: [{ station: "bar", status: "queued", readyAt: null, pickedUpAt: null }],
    ...overrides,
  };
}

describe("resolveGuestStatusIntel", () => {
  it("returns no_open_order when nothing is waiting", () => {
    const intel = resolveGuestStatusIntel({
      orders: [{ ...drinkOrder(), status: "delivered" }],
      config,
      nowMs: NOW,
    });

    expect(intel.scenario).toBe("no_open_order");
    expect(intel.needsStationTicket).toBe(false);
  });

  it("returns just_placed for a brand-new order", () => {
    const intel = resolveGuestStatusIntel({
      orders: [
        drinkOrder({
          createdAt: "2026-07-01T18:09:15.000Z",
          status: "pending",
        }),
      ],
      config,
      nowMs: NOW,
    });

    expect(intel.scenario).toBe("just_placed");
    expect(intel.needsStationTicket).toBe(false);
  });

  it("returns in_progress when bar is actively preparing", () => {
    const intel = resolveGuestStatusIntel({
      orders: [
        drinkOrder({
          status: "preparing",
          stationStates: [
            { station: "bar", status: "in_prep", readyAt: null, pickedUpAt: null },
          ],
        }),
      ],
      config,
      nowMs: NOW,
    });

    expect(intel.scenario).toBe("in_progress");
    expect(intel.needsStationTicket).toBe(false);
  });

  it("returns queue_busy when bar is rushed but order is still young", () => {
    const venueOps: VenueOpsBeliefs = {
      operatingMode: "normal",
      kdsStress: "normal",
      acceptingOrders: true,
      unavailableProductIds: [],
      staffHint: null,
      stationStress: [
        { station: "bar", activeCount: 6, avgWaitMinutes: 7, stress: "busy" },
      ],
    };

    const intel = resolveGuestStatusIntel({
      orders: [drinkOrder({ createdAt: "2026-07-01T18:08:00.000Z" })],
      venueOps,
      config,
      nowMs: NOW,
    });

    expect(intel.scenario).toBe("queue_busy");
    expect(intel.needsStationTicket).toBe(false);
    expect(intel.barActiveOrders).toBe(6);
  });

  it("opens station ticket when drink order is stuck past SLA in a rush", () => {
    const venueOps: VenueOpsBeliefs = {
      operatingMode: "normal",
      kdsStress: "normal",
      acceptingOrders: true,
      unavailableProductIds: [],
      staffHint: null,
      stationStress: [
        { station: "bar", activeCount: 5, avgWaitMinutes: 8, stress: "busy" },
      ],
    };

    const intel = resolveGuestStatusIntel({
      orders: [
        drinkOrder({
          createdAt: "2026-07-01T18:04:00.000Z",
          status: "accepted",
        }),
      ],
      venueOps,
      config,
      nowMs: NOW,
    });

    expect(intel.scenario).toBe("needs_station_check");
    expect(intel.needsStationTicket).toBe(true);
    expect(intel.targetStation).toBe("bar");
  });

  it("reuses fresh station answer without opening a ticket", () => {
    const intel = resolveGuestStatusIntel({
      orders: [drinkOrder()],
      config,
      nowMs: NOW,
      freshStationAnswer: {
        answer: "eta",
        etaMinutes: 3,
        station: "bar",
        answeredAt: "2026-07-01T18:09:00.000Z",
        ageMinutes: 1,
      },
    });

    expect(intel.scenario).toBe("bar_answered");
    expect(intel.needsStationTicket).toBe(false);
  });
});
