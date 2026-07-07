import { describe, expect, it } from "vitest";
import {
  READ_ONLY_TOOL_CATALOG,
  listReadOnlyToolDefinitions,
} from "@/lib/denis/agentic/tool-catalog";
import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";

describe("READ_ONLY_TOOL_CATALOG", () => {
  it("lists a tool definition for every catalog entry", () => {
    const definitions = listReadOnlyToolDefinitions();
    expect(definitions.map((d) => d.name).sort()).toEqual(
      Object.keys(READ_ONLY_TOOL_CATALOG).sort()
    );
  });

  it("check_kitchen_status reads already-computed venueOps with zero DB calls", async () => {
    const ctx = {
      locationId: "loc_1",
      venueOps: {
        stationStress: [
          { station: "kitchen", stress: "overloaded", activeCount: 9, avgWaitMinutes: 30 },
        ],
      },
    } as unknown as DenisTurnContext;

    const result = await READ_ONLY_TOOL_CATALOG.check_kitchen_status.execute(
      { admin: {} as never, ctx },
      {}
    );

    expect(result).toEqual({
      known: true,
      stress: "overloaded",
      activeOrders: 9,
      avgWaitMinutes: 30,
    });
  });

  it("check_kitchen_status reports known:false when there is no station data", async () => {
    const ctx = { locationId: "loc_1" } as unknown as DenisTurnContext;
    const result = await READ_ONLY_TOOL_CATALOG.check_kitchen_status.execute(
      { admin: {} as never, ctx },
      {}
    );
    expect(result).toEqual({ known: false });
  });

  it("check_station_stress filters by the requested station", async () => {
    const ctx = {
      locationId: "loc_1",
      venueOps: {
        stationStress: [
          { station: "kitchen", stress: "normal", activeCount: 1, avgWaitMinutes: 3 },
          { station: "bar", stress: "busy", activeCount: 5, avgWaitMinutes: 10 },
        ],
      },
    } as unknown as DenisTurnContext;

    const result = await READ_ONLY_TOOL_CATALOG.check_station_stress.execute(
      { admin: {} as never, ctx },
      { station: "bar" }
    );

    expect(result).toEqual({
      known: true,
      station: "bar",
      stress: "busy",
      activeOrders: 5,
      avgWaitMinutes: 10,
    });
  });

  it("check_bill reports known:false when there is no session", async () => {
    const ctx = { locationId: "loc_1" } as unknown as DenisTurnContext;
    const result = await READ_ONLY_TOOL_CATALOG.check_bill.execute(
      { admin: {} as never, ctx },
      {}
    );
    expect(result).toEqual({ known: false });
  });
});
