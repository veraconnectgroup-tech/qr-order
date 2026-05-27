import { describe, expect, it } from "vitest";
import {
  floorHintLabel,
  prioritizeStaffCopilotTables,
  staffCopilotPriorityTables,
} from "@/lib/denis/venue/copilot/prioritize-tables";
import type { StaffCopilotTableRow } from "@/lib/denis/venue/copilot/types";

function table(
  partial: Partial<StaffCopilotTableRow> & Pick<StaffCopilotTableRow, "tableId" | "tableName">
): StaffCopilotTableRow {
  return {
    operatingHint: null,
    openOrderCount: 0,
    seatedMinutes: null,
    hasActiveSession: false,
    staffHint: null,
    ...partial,
  };
}

describe("staff copilot prioritize M15", () => {
  it("sorts needs_attention before dessert and idle", () => {
    const sorted = prioritizeStaffCopilotTables([
      table({ tableId: "1", tableName: "T1", operatingHint: "idle" }),
      table({
        tableId: "2",
        tableName: "T2",
        operatingHint: "needs_attention",
      }),
      table({
        tableId: "3",
        tableName: "T3",
        operatingHint: "ready_for_dessert",
      }),
    ]);

    expect(sorted.map((row) => row.tableId)).toEqual(["2", "3", "1"]);
  });

  it("filters priority rows with hints or open orders", () => {
    const priority = staffCopilotPriorityTables([
      table({ tableId: "1", tableName: "Quiet" }),
      table({ tableId: "2", tableName: "Busy", openOrderCount: 2 }),
      table({
        tableId: "3",
        tableName: "Hinted",
        staffHint: { text: "VIP", visibility: "denis_only" },
      }),
    ]);

    expect(priority.map((row) => row.tableId)).toEqual(["2", "3"]);
  });

  it("labels floor hints for staff UI", () => {
    expect(floorHintLabel("needs_attention")).toBe("Needs attention");
    expect(floorHintLabel(null)).toBeNull();
  });
});
