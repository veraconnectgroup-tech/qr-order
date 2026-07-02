import { describe, expect, it } from "vitest";
import { aggregateGlobalStatus } from "@/lib/orders/station-states";
import {
  barDisplayGlobalStatus,
  kitchenKdsColumnForOrder,
  nextBarAdvanceAction,
  nextKitchenAdvanceAction,
  waiterNeedsLegacyDeliver,
  waiterStationActions,
} from "@/lib/orders/station-display";

describe("kitchenKdsColumnForOrder", () => {
  it("places kitchen in_prep in preparing column while global stays preparing (mixed)", () => {
    expect(
      kitchenKdsColumnForOrder("preparing", {
        order_id: "o1",
        station: "kitchen",
        status: "in_prep",
        ready_at: null,
        picked_up_at: null,
        served_at: null,
      })
    ).toBe("preparing");
  });

  it("places kitchen ready in ready column even when global is still preparing", () => {
    expect(
      kitchenKdsColumnForOrder("preparing", {
        order_id: "o1",
        station: "kitchen",
        status: "ready",
        ready_at: "2026-07-01T20:00:00Z",
        picked_up_at: null,
        served_at: null,
      })
    ).toBe("ready");
  });

  it("falls back to global status when station row is missing", () => {
    expect(kitchenKdsColumnForOrder("preparing", undefined)).toBe("preparing");
    expect(kitchenKdsColumnForOrder("accepted", undefined)).toBe("accepted");
  });
});

describe("mixed order aggregation (S2 scenario)", () => {
  it("bar ready + kitchen in_prep keeps global preparing", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "bar", status: "ready" },
          { station: "kitchen", status: "in_prep" },
        ],
        "preparing"
      )
    ).toBe("preparing");
  });

  it("all stations served yields delivered", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "bar", status: "served" },
          { station: "kitchen", status: "served" },
        ],
        "ready"
      )
    ).toBe("delivered");
  });
});

describe("nextKitchenAdvanceAction", () => {
  it("uses station API for in_prep when kitchen row exists", () => {
    expect(
      nextKitchenAdvanceAction("accepted", {
        order_id: "o1",
        station: "kitchen",
        status: "queued",
        ready_at: null,
        picked_up_at: null,
        served_at: null,
      })
    ).toEqual({ kind: "station", station: "kitchen", status: "in_prep" });
  });

  it("does not offer delivered from KDS", () => {
    expect(
      nextKitchenAdvanceAction("ready", {
        order_id: "o1",
        station: "kitchen",
        status: "ready",
        ready_at: null,
        picked_up_at: null,
        served_at: null,
      })
    ).toBeNull();
  });
});

describe("nextBarAdvanceAction", () => {
  it("does not offer delivered from bar", () => {
    expect(
      nextBarAdvanceAction("ready", {
        order_id: "o1",
        station: "bar",
        status: "ready",
        ready_at: null,
        picked_up_at: null,
        served_at: null,
      })
    ).toBeNull();
  });
});

describe("barDisplayGlobalStatus", () => {
  it("shows ready when bar station is ready but global is preparing", () => {
    expect(
      barDisplayGlobalStatus("preparing", {
        order_id: "o1",
        station: "bar",
        status: "ready",
        ready_at: null,
        picked_up_at: null,
        served_at: null,
      })
    ).toBe("ready");
  });
});

describe("waiterStationActions", () => {
  it("offers picked_up and served per station", () => {
    expect(
      waiterStationActions(
        [{ menu_section: "drinks" }, { menu_section: "food" }],
        [
          {
            order_id: "o1",
            station: "bar",
            status: "ready",
            ready_at: null,
            picked_up_at: null,
            served_at: null,
          },
          {
            order_id: "o1",
            station: "kitchen",
            status: "picked_up",
            ready_at: null,
            picked_up_at: null,
            served_at: null,
          },
        ]
      )
    ).toEqual([
      { station: "bar", toStatus: "picked_up", labelKey: "action.pickedUp" },
      { station: "kitchen", toStatus: "served", labelKey: "action.served" },
    ]);
  });
});

describe("waiterNeedsLegacyDeliver", () => {
  it("allows legacy global deliver only without station rows", () => {
    expect(waiterNeedsLegacyDeliver("ready", [])).toBe(true);
    expect(waiterNeedsLegacyDeliver("ready", undefined)).toBe(true);
    expect(
      waiterNeedsLegacyDeliver("ready", [
        {
          order_id: "o1",
          station: "bar",
          status: "ready",
          ready_at: null,
          picked_up_at: null,
          served_at: null,
        },
      ])
    ).toBe(false);
  });
});
