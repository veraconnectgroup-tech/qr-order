import { describe, expect, it } from "vitest";
import {
  buildStaffTableBrief,
  resolveTableRevenueOpportunity,
} from "@/lib/denis/venue/copilot/build-staff-table-brief";
import {
  floorHintLabel,
  prioritizeStaffCopilotTables,
  staffCopilotPriorityTables,
} from "@/lib/denis/venue/copilot/prioritize-tables";
import { resolveStaffCopilotTablePriority } from "@/lib/denis/venue/copilot/resolve-table-priority";
import type { StaffCopilotTableRow } from "@/lib/denis/venue/copilot/types";
import {
  buildEventCopilotLines,
  resolveEventEffects,
} from "@/lib/denis/venue/ops/event-mode";

function table(
  partial: Partial<StaffCopilotTableRow> & Pick<StaffCopilotTableRow, "tableId" | "tableName">
): StaffCopilotTableRow {
  return {
    priority: "normal",
    operatingHint: null,
    openOrderCount: 0,
    seatedMinutes: null,
    hasActiveSession: false,
    guestWaitMinutes: null,
    staffHint: null,
    staffBrief: null,
    revenueOpportunity: null,
    ...partial,
  };
}

describe("staff copilot prioritize M15", () => {
  it("sorts urgent before high before normal", () => {
    const sorted = prioritizeStaffCopilotTables([
      table({ tableId: "1", tableName: "T1", priority: "normal" }),
      table({ tableId: "2", tableName: "T2", priority: "urgent" }),
      table({ tableId: "3", tableName: "T3", priority: "high" }),
    ]);

    expect(sorted.map((row) => row.tableId)).toEqual(["2", "3", "1"]);
  });

  it("sorts needs_attention before dessert and idle within same priority", () => {
    const sorted = prioritizeStaffCopilotTables([
      table({ tableId: "1", tableName: "T1", priority: "high", operatingHint: "idle" }),
      table({
        tableId: "2",
        tableName: "T2",
        priority: "high",
        operatingHint: "needs_attention",
      }),
      table({
        tableId: "3",
        tableName: "T3",
        priority: "high",
        operatingHint: "ready_for_dessert",
      }),
    ]);

    expect(sorted.map((row) => row.tableId)).toEqual(["2", "3", "1"]);
  });

  it("filters priority rows with hints, briefs, or revenue opportunities", () => {
    const priority = staffCopilotPriorityTables([
      table({ tableId: "1", tableName: "Quiet", priority: "idle" }),
      table({ tableId: "2", tableName: "Busy", openOrderCount: 2, priority: "high" }),
      table({
        tableId: "3",
        tableName: "Hinted",
        staffHint: { text: "VIP", visibility: "denis_only" },
        priority: "normal",
      }),
      table({
        tableId: "4",
        tableName: "Upsell",
        priority: "normal",
        revenueOpportunity: { title: "food upsell", priority: "normal" },
      }),
    ]);

    expect(priority.map((row) => row.tableId)).toEqual(["2", "3", "4"]);
  });

  it("labels floor hints for staff UI", () => {
    expect(floorHintLabel("needs_attention")).toBe("Needs attention");
    expect(floorHintLabel(null)).toBeNull();
  });
});

describe("staff copilot table priority", () => {
  it("15+ min wait → priority urgent", () => {
    expect(
      resolveStaffCopilotTablePriority({
        operatingHint: "needs_attention",
        guestWaitMinutes: 15,
        frustrationLevel: "none",
        hasActiveSession: true,
        openOrderCount: 1,
      })
    ).toBe("urgent");
  });

  it("frustrated guest → priority urgent", () => {
    expect(
      resolveStaffCopilotTablePriority({
        operatingHint: null,
        guestWaitMinutes: 5,
        frustrationLevel: "high",
        hasActiveSession: true,
        openOrderCount: 0,
      })
    ).toBe("urgent");
  });

  it("needs_attention with open orders → high", () => {
    expect(
      resolveStaffCopilotTablePriority({
        operatingHint: "needs_attention",
        guestWaitMinutes: 8,
        frustrationLevel: "none",
        hasActiveSession: true,
        openOrderCount: 1,
      })
    ).toBe("high");
  });
});

describe("staff copilot brief + revenue", () => {
  it("builds gluten + cart + wait brief", () => {
    const brief = buildStaffTableBrief({
      tableName: "3",
      guestTopics: ["bezglutensko"],
      cartSummary: "Pilsner",
      guestWaitMinutes: 8,
      sessionCheckEuros: null,
      partySize: null,
      operatingHint: "needs_attention",
      staffHintText: null,
      frustrationLevel: "none",
    });

    expect(brief).toBe("Sto 3: gost pita za bezglutensko, cart ima Pilsner, čeka 8min");
  });

  it("low spend → revenue opportunity", () => {
    const opportunity = resolveTableRevenueOpportunity({
      tableName: "9",
      sessionCheckEuros: 10,
      operatingHint: null,
      hasActiveSession: true,
    });

    expect(opportunity).toMatchObject({
      title: expect.stringContaining("niska potrošnja"),
    });
    expect(opportunity).toMatchObject({
      title: expect.stringContaining("additional food"),
    });
  });
});

describe("birthday event copilot block", () => {
  it("includes cake time and special instructions", () => {
    const eventNow = Date.parse("2026-06-28T19:00:00.000Z");
    const event = {
      name: "Rođendan Marko",
      expectedGuests: 12,
      presetMenu: false,
      startTime: "18:00",
      endTime: "23:00",
      specialInstructions: "srećan rođendan pesma",
      cakeAt: "21:30",
    };

    const lines = buildEventCopilotLines({
      event,
      effects: resolveEventEffects(event, "during", eventNow),
      stats: {
        orderedGuestCount: 5,
        activeSessionCount: 6,
        tablesWithoutOrder: 1,
        topProducts: [],
      },
      nowMs: eventNow,
    });

    const joined = lines.join("\n");
    expect(joined).toContain("Rođendan Marko");
    expect(joined).toContain("Torta");
    expect(joined).toContain("srećan rođendan pesma");
  });
});
