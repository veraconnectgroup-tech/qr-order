import type { FloorTableHint } from "@/lib/denis/venue/floor/types";
import type { StaffCopilotTableRow } from "@/lib/denis/venue/copilot/types";

const HINT_PRIORITY: Record<NonNullable<FloorTableHint>, number> = {
  needs_attention: 0,
  ready_for_dessert: 1,
  idle: 2,
};

export function floorHintLabel(hint: FloorTableHint): string | null {
  switch (hint) {
    case "needs_attention":
      return "Needs attention";
    case "ready_for_dessert":
      return "Dessert opportunity";
    case "idle":
      return "Idle table";
    default:
      return null;
  }
}

/** Sort tables for staff copilot — urgent hints first (M15). */
export function prioritizeStaffCopilotTables(
  tables: StaffCopilotTableRow[]
): StaffCopilotTableRow[] {
  return [...tables].sort((a, b) => {
    const aRank =
      a.operatingHint != null ? HINT_PRIORITY[a.operatingHint] : 99;
    const bRank =
      b.operatingHint != null ? HINT_PRIORITY[b.operatingHint] : 99;
    if (aRank !== bRank) return aRank - bRank;
    if (b.openOrderCount !== a.openOrderCount) {
      return b.openOrderCount - a.openOrderCount;
    }
    return a.tableName.localeCompare(b.tableName);
  });
}

export function staffCopilotPriorityTables(
  tables: StaffCopilotTableRow[]
): StaffCopilotTableRow[] {
  return prioritizeStaffCopilotTables(tables).filter(
    (table) =>
      table.operatingHint != null ||
      table.openOrderCount > 0 ||
      table.staffHint != null
  );
}
