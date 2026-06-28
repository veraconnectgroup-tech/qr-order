import type { FloorTableHint } from "@/lib/denis/venue/floor/types";
import type { StaffCopilotTablePriority } from "@/lib/denis/venue/copilot/types";

/** Map floor + session signals → staff copilot priority tier (M15). */
export function resolveStaffCopilotTablePriority(input: {
  operatingHint: FloorTableHint;
  guestWaitMinutes: number | null;
  frustrationLevel: "none" | "mild" | "high";
  hasActiveSession: boolean;
  openOrderCount: number;
}): StaffCopilotTablePriority {
  if (
    input.frustrationLevel === "high" ||
    (input.guestWaitMinutes != null && input.guestWaitMinutes >= 15)
  ) {
    return "urgent";
  }

  if (
    input.operatingHint === "needs_attention" ||
    input.openOrderCount > 0 ||
    input.frustrationLevel === "mild" ||
    (input.guestWaitMinutes != null && input.guestWaitMinutes >= 10)
  ) {
    return "high";
  }

  if (!input.hasActiveSession || input.operatingHint === "idle") {
    return "idle";
  }

  if (input.hasActiveSession) {
    return "normal";
  }

  return "idle";
}

const PRIORITY_SORT_RANK: Record<StaffCopilotTablePriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  idle: 3,
};

export function staffCopilotPrioritySortRank(
  priority: StaffCopilotTablePriority
): number {
  return PRIORITY_SORT_RANK[priority];
}
