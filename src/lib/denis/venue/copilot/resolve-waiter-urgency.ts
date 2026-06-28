import type { FloorTableHint } from "@/lib/denis/venue/floor/types";
import type { StaffActionPriority } from "@/lib/denis/venue/copilot/types";
import type { WaiterUrgency } from "@/lib/denis/venue/copilot/waiter-copilot-types";

/** Green / yellow / red urgency for waiter floor UI. */
export function resolveWaiterUrgency(input: {
  operatingHint: FloorTableHint;
  actionPriority: StaffActionPriority | null;
  hasWaiterCall: boolean;
  guestWaitMinutes: number | null;
  frustrationLevel: "none" | "mild" | "high";
  allergyLabels: string[];
}): WaiterUrgency {
  if (
    input.hasWaiterCall ||
    input.frustrationLevel === "high" ||
    input.allergyLabels.length > 0 ||
    input.operatingHint === "needs_attention" ||
    input.actionPriority === "urgent"
  ) {
    return "red";
  }

  if (
    input.frustrationLevel === "mild" ||
    input.operatingHint === "ready_for_dessert" ||
    input.actionPriority === "high" ||
    (input.guestWaitMinutes != null && input.guestWaitMinutes >= 10)
  ) {
    return "yellow";
  }

  return "green";
}

export function waiterUrgencySortRank(urgency: WaiterUrgency): number {
  switch (urgency) {
    case "red":
      return 0;
    case "yellow":
      return 1;
    case "green":
      return 2;
  }
}
