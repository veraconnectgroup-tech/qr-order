import type { WaiterTableSummaryInput } from "@/lib/denis/venue/copilot/waiter-copilot-types";

/** Compact Denis brief for waiter table cards — deterministic, no LLM. */
export function buildWaiterTableSummary(input: WaiterTableSummaryInput): string {
  const parts: string[] = [];

  if (input.hasWaiterCall) {
    parts.push("Traži konobara");
  }

  if (input.guestWaitMinutes != null && input.guestWaitMinutes >= 5) {
    parts.push(`Čekaju ${input.guestWaitMinutes}min`);
  }

  if (input.frustrationLevel === "high") {
    parts.push("mental:frustrated");
  } else if (input.frustrationLevel === "mild") {
    parts.push("mental:impatient");
  }

  if (input.allergyLabels.length > 0) {
    parts.push(`alergija:${input.allergyLabels.slice(0, 2).join(",")}`);
  } else if (input.operatingHint === "needs_attention") {
    parts.push("treba pažnja");
  } else if (input.operatingHint === "ready_for_dessert") {
    parts.push("desert prilika");
  } else if (input.operatingHint === "idle") {
    parts.push("idle");
  }

  if (parts.length === 0 && input.operatingHint == null) {
    return "Denis: OK";
  }

  return parts.join(", ");
}
