import { describe, expect, it } from "vitest";
import { assembleGuestTurnOperationalContext } from "@/lib/denis/cognition/context/assemble-operational-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import type { VenueOpsBeliefs, StationStress } from "@/lib/denis/venue/ops/types";

function stationStress(overrides: Partial<StationStress> & { station: string }): StationStress {
  return {
    stress: "normal",
    activeCount: 0,
    avgWaitMinutes: null,
    ...overrides,
  };
}

function venueOps(stationStressList: StationStress[]): VenueOpsBeliefs {
  return {
    operatingMode: "normal",
    kdsStress: "normal",
    acceptingOrders: true,
    unavailableProductIds: [],
    staffHint: null,
    stationStress: stationStressList,
  };
}

describe("assembleGuestTurnOperationalContext", () => {
  it("has no correlated note on a calm shift (no busy stations, no frustration)", () => {
    const ctx = assembleGuestTurnOperationalContext({
      venueOps: venueOps([
        stationStress({ station: "kitchen", stress: "normal" }),
        stationStress({ station: "bar", stress: "normal" }),
      ]),
      mental: emptyGuestMentalModel(),
    });

    expect(ctx.correlatedNote).toBeNull();
    expect(ctx.guestFrustration).toBeNull();
  });

  it("has no correlated note when only the station is busy (guest not frustrated)", () => {
    const ctx = assembleGuestTurnOperationalContext({
      venueOps: venueOps([
        stationStress({ station: "kitchen", stress: "overloaded" }),
      ]),
      mental: emptyGuestMentalModel(),
    });

    expect(ctx.correlatedNote).toBeNull();
  });

  it("has no correlated note when only the guest is frustrated (stations calm)", () => {
    const mental = emptyGuestMentalModel();
    mental.affect.frustration = { level: "high", signals: ["repeated_asks"] };

    const ctx = assembleGuestTurnOperationalContext({
      venueOps: venueOps([
        stationStress({ station: "kitchen", stress: "normal" }),
      ]),
      mental,
    });

    expect(ctx.correlatedNote).toBeNull();
    expect(ctx.guestFrustration).toEqual({
      level: "high",
      signals: ["repeated_asks"],
    });
  });

  it("produces a correlated note when a station is busy AND the guest is frustrated", () => {
    const mental = emptyGuestMentalModel();
    mental.affect.frustration = { level: "mild", signals: ["wait_time"] };

    const ctx = assembleGuestTurnOperationalContext({
      venueOps: venueOps([
        stationStress({ station: "kitchen", stress: "busy" }),
        stationStress({ station: "bar", stress: "normal" }),
      ]),
      mental,
    });

    expect(ctx.correlatedNote).not.toBeNull();
    expect(ctx.correlatedNote).toMatch(/kitchen/i);
    expect(ctx.correlatedNote).toMatch(/mild/i);
    expect(ctx.correlatedNote).not.toMatch(/bar/i);
  });

  it("mentions both stations when both are busy", () => {
    const mental = emptyGuestMentalModel();
    mental.affect.frustration = { level: "high", signals: [] };

    const ctx = assembleGuestTurnOperationalContext({
      venueOps: venueOps([
        stationStress({ station: "kitchen", stress: "high" }),
        stationStress({ station: "bar", stress: "overloaded" }),
      ]),
      mental,
    });

    expect(ctx.correlatedNote).toMatch(/kitchen/i);
    expect(ctx.correlatedNote).toMatch(/bar/i);
  });

  it("is null-safe when venueOps and mental are both missing", () => {
    const ctx = assembleGuestTurnOperationalContext({
      venueOps: null,
      mental: null,
    });

    expect(ctx.correlatedNote).toBeNull();
    expect(ctx.guestFrustration).toBeNull();
    expect(ctx.stations.kitchen).toBeNull();
    expect(ctx.stations.bar).toBeNull();
  });
});
