import { describe, expect, it } from "vitest";
import {
  aggregateGlobalStatus,
  assertRoleCanPatchStation,
  isValidStationTransition,
  stationsForOrderItems,
  STATION_VALID_TRANSITIONS,
} from "@/lib/orders/station-states";

describe("stationsForOrderItems", () => {
  it("maps food and desserts to kitchen", () => {
    expect(
      stationsForOrderItems([
        { menu_section: "food" },
        { menu_section: "desserts" },
      ])
    ).toEqual(new Set(["kitchen"]));
  });

  it("maps drinks to bar", () => {
    expect(stationsForOrderItems([{ menu_section: "drinks" }])).toEqual(
      new Set(["bar"])
    );
  });

  it("returns both stations for mixed orders", () => {
    expect(
      stationsForOrderItems([
        { menu_section: "food" },
        { menu_section: "drinks" },
      ])
    ).toEqual(new Set(["kitchen", "bar"]));
  });
});

describe("aggregateGlobalStatus", () => {
  it("any in_prep -> preparing", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "kitchen", status: "in_prep" },
          { station: "bar", status: "queued" },
        ],
        "accepted"
      )
    ).toBe("preparing");
  });

  it("bar ready + kitchen in_prep -> preparing (mixed conflict baseline)", () => {
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

  it("all ready+ -> ready", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "bar", status: "ready" },
          { station: "kitchen", status: "picked_up" },
        ],
        "preparing"
      )
    ).toBe("ready");
  });

  it("all served -> delivered", () => {
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

  it("one served one ready -> ready (not all served)", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "bar", status: "served" },
          { station: "kitchen", status: "ready" },
        ],
        "preparing"
      )
    ).toBe("ready");
  });

  it("never moves global backward when stations regress logically", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "bar", status: "queued" },
          { station: "kitchen", status: "queued" },
        ],
        "ready"
      )
    ).toBe("ready");
  });

  it("never moves global backward from delivered", () => {
    expect(
      aggregateGlobalStatus(
        [{ station: "kitchen", status: "in_prep" }],
        "delivered"
      )
    ).toBe("delivered");
  });

  it("ignores cancelled station rows when aggregating", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "kitchen", status: "cancelled" },
          { station: "bar", status: "in_prep" },
        ],
        "accepted"
      )
    ).toBe("preparing");
  });

  it("keeps current global when all station rows are cancelled", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "kitchen", status: "cancelled" },
          { station: "bar", status: "cancelled" },
        ],
        "preparing"
      )
    ).toBe("preparing");
  });

  it("does not revive cancelled/rejected global orders", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "bar", status: "served" },
          { station: "kitchen", status: "served" },
        ],
        "cancelled"
      )
    ).toBe("cancelled");
  });
});

describe("STATION_VALID_TRANSITIONS", () => {
  it("covers the station lifecycle chain", () => {
    expect(STATION_VALID_TRANSITIONS.queued).toContain("in_prep");
    expect(STATION_VALID_TRANSITIONS.in_prep).toContain("ready");
    expect(STATION_VALID_TRANSITIONS.ready).toContain("picked_up");
    expect(STATION_VALID_TRANSITIONS.picked_up).toContain("served");
  });

  it("allows cancelled from every active state", () => {
    for (const state of ["queued", "in_prep", "ready", "picked_up"] as const) {
      expect(STATION_VALID_TRANSITIONS[state]).toContain("cancelled");
    }
  });
});

describe("isValidStationTransition", () => {
  it("rejects backward transitions", () => {
    expect(isValidStationTransition("ready", "in_prep")).toBe(false);
    expect(isValidStationTransition("served", "ready")).toBe(false);
  });
});

describe("assertRoleCanPatchStation", () => {
  it("bar cannot patch kitchen station", () => {
    const result = assertRoleCanPatchStation({
      role: "bar",
      station: "kitchen",
      fromStatus: "queued",
      toStatus: "in_prep",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/bar station/i);
    }
  });

  it("waiter cannot start prep", () => {
    const result = assertRoleCanPatchStation({
      role: "waiter",
      station: "kitchen",
      fromStatus: "queued",
      toStatus: "in_prep",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/ready → picked_up/i);
    }
  });

  it("manager can apply any valid transition", () => {
    expect(
      assertRoleCanPatchStation({
        role: "manager",
        station: "kitchen",
        fromStatus: "ready",
        toStatus: "picked_up",
      }).ok
    ).toBe(true);
  });

  it("kitchen can advance prep on kitchen only", () => {
    expect(
      assertRoleCanPatchStation({
        role: "kitchen",
        station: "kitchen",
        fromStatus: "in_prep",
        toStatus: "ready",
      }).ok
    ).toBe(true);
  });

  it("waiter can mark picked up and served", () => {
    expect(
      assertRoleCanPatchStation({
        role: "waiter",
        station: "bar",
        fromStatus: "ready",
        toStatus: "picked_up",
      }).ok
    ).toBe(true);
    expect(
      assertRoleCanPatchStation({
        role: "waiter",
        station: "kitchen",
        fromStatus: "picked_up",
        toStatus: "served",
      }).ok
    ).toBe(true);
  });
});
