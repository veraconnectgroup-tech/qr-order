import { describe, expect, it } from "vitest";
import { buildWaiterHandoffContext } from "@/lib/denis/venue/copilot/build-waiter-handoff-context";
import { buildWaiterTableSummary } from "@/lib/denis/venue/copilot/build-waiter-table-summary";
import {
  prioritizeStaffCopilotTables,
  staffCopilotPriorityTables,
} from "@/lib/denis/venue/copilot/prioritize-tables";
import {
  resolveWaiterUrgency,
  waiterUrgencySortRank,
} from "@/lib/denis/venue/copilot/resolve-waiter-urgency";
import type { StaffCopilotTableRow } from "@/lib/denis/venue/copilot/types";
import type {
  WaiterCopilotTableRow,
  WaiterSessionIntel,
} from "@/lib/denis/venue/copilot/waiter-copilot-types";

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

function enrichForSort(
  row: StaffCopilotTableRow,
  urgency: WaiterCopilotTableRow["urgency"],
  guestWaitMinutes: number | null = null
): WaiterCopilotTableRow {
  return {
    ...row,
    summary: "",
    urgency,
    suggestedAction: null,
    actionPriority: null,
    guestWaitMinutes,
  };
}

function sortWaiterPriorityTables(tables: WaiterCopilotTableRow[]): WaiterCopilotTableRow[] {
  return [...tables].sort((a, b) => {
    const urgencyDiff = waiterUrgencySortRank(a.urgency) - waiterUrgencySortRank(b.urgency);
    if (urgencyDiff !== 0) return urgencyDiff;
    const waitA = a.guestWaitMinutes ?? -1;
    const waitB = b.guestWaitMinutes ?? -1;
    if (waitA !== waitB) return waitB - waitA;
    return a.tableName.localeCompare(b.tableName);
  });
}

describe("waiter Denis copilot", () => {
  it("handoff → waiter sees allergy + cart context", () => {
    const intel: WaiterSessionIntel = {
      allergyLabels: ["gluten"],
      frustrationLevel: "none",
      cartSummary: "2x Pilsner",
      guestTopics: ["bezglutensko"],
    };

    const contextLine = buildWaiterHandoffContext({
      tableName: "3",
      baseMessage: "Sto 3 traži konobara (Pozovi)",
      notificationType: "waiter_call",
      intel,
    });

    expect(contextLine).toContain("3 traži konobara");
    expect(contextLine).toContain("bezglutensko");
    expect(contextLine).toContain("Cart: 2x Pilsner");
  });

  it("copilot → priority list sorted red before yellow before green", () => {
    const sorted = sortWaiterPriorityTables([
      enrichForSort(table({ tableId: "1", tableName: "T1" }), "green"),
      enrichForSort(
        table({ tableId: "2", tableName: "T2", operatingHint: "ready_for_dessert" }),
        "yellow",
        8
      ),
      enrichForSort(
        table({ tableId: "3", tableName: "T3", operatingHint: "needs_attention" }),
        "red",
        12
      ),
    ]);

    expect(sorted.map((row) => row.tableId)).toEqual(["3", "2", "1"]);
  });

  it("M15 priority tables still sort needs_attention first", () => {
    const sorted = prioritizeStaffCopilotTables([
      table({ tableId: "1", tableName: "T1", operatingHint: "idle" }),
      table({ tableId: "2", tableName: "T2", operatingHint: "needs_attention" }),
      table({ tableId: "3", tableName: "T3", operatingHint: "ready_for_dessert" }),
    ]);

    expect(sorted.map((row) => row.tableId)).toEqual(["2", "3", "1"]);
  });

  it("builds compact Denis table summary", () => {
    const summary = buildWaiterTableSummary({
      operatingHint: "needs_attention",
      guestWaitMinutes: 12,
      frustrationLevel: "high",
      allergyLabels: ["gluten"],
      hasWaiterCall: false,
    });

    expect(summary).toContain("Čekaju 12min");
    expect(summary).toContain("mental:frustrated");
    expect(summary).toContain("alergija:gluten");
  });

  it("urgency is red for waiter call + allergy", () => {
    expect(
      resolveWaiterUrgency({
        operatingHint: null,
        actionPriority: null,
        hasWaiterCall: true,
        guestWaitMinutes: null,
        frustrationLevel: "none",
        allergyLabels: [],
      })
    ).toBe("red");

    expect(
      resolveWaiterUrgency({
        operatingHint: null,
        actionPriority: null,
        hasWaiterCall: false,
        guestWaitMinutes: null,
        frustrationLevel: "none",
        allergyLabels: ["gluten"],
      })
    ).toBe("red");
  });

  it("filters staffCopilotPriorityTables with open orders", () => {
    const priority = staffCopilotPriorityTables([
      table({ tableId: "1", tableName: "Quiet" }),
      table({ tableId: "2", tableName: "Busy", openOrderCount: 2 }),
    ]);

    expect(priority.map((row) => row.tableId)).toEqual(["2"]);
  });
});
