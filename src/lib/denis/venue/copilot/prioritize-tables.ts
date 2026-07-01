import type { FloorTableHint } from "@/lib/denis/venue/floor/types";
import type {
  StaffCopilotTablePriority,
  StaffCopilotTableRow,
} from "@/lib/denis/venue/copilot/types";
import { staffCopilotPrioritySortRank } from "@/lib/denis/venue/copilot/resolve-table-priority";

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

export function staffCopilotPriorityLabel(
  priority: StaffCopilotTablePriority
): string {
  switch (priority) {
    case "urgent":
      return "Urgent";
    case "high":
      return "High";
    case "normal":
      return "Normal";
    case "idle":
      return "Idle";
  }
}

/** Sort tables for staff copilot — urgent tier first (M15). */
export function prioritizeStaffCopilotTables(
  tables: StaffCopilotTableRow[]
): StaffCopilotTableRow[] {
  return [...tables].sort((a, b) => {
    const priorityDiff =
      staffCopilotPrioritySortRank(a.priority) -
      staffCopilotPrioritySortRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const aRank =
      a.operatingHint != null ? HINT_PRIORITY[a.operatingHint] : 99;
    const bRank =
      b.operatingHint != null ? HINT_PRIORITY[b.operatingHint] : 99;
    if (aRank !== bRank) return aRank - bRank;

    const waitA = a.guestWaitMinutes ?? -1;
    const waitB = b.guestWaitMinutes ?? -1;
    if (waitA !== waitB) return waitB - waitA;

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
      table.priority === "urgent" ||
      table.priority === "high" ||
      table.operatingHint != null ||
      table.openOrderCount > 0 ||
      table.staffHint != null ||
      table.staffBrief != null ||
      table.revenueOpportunity != null
  );
}
