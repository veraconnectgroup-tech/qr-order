import type { WaiterSessionIntel } from "@/lib/denis/venue/copilot/waiter-copilot-types";

/** Rich handoff line for waiter notifications — e.g. allergy + cart context. */
export function buildWaiterHandoffContext(input: {
  tableName: string;
  baseMessage: string;
  notificationType: string;
  intel: WaiterSessionIntel | null;
}): string {
  const tableLabel = input.tableName.trim() || "—";
  const reasonParts: string[] = [];

  if (input.notificationType === "waiter_call") {
    reasonParts.push(`${tableLabel} traži konobara`);
  } else if (input.notificationType === "allergy_alert") {
    reasonParts.push(`${tableLabel} — alergija`);
  } else {
    reasonParts.push(input.baseMessage.replace(/^Sto\s+/i, `${tableLabel} — `));
  }

  const intel = input.intel;
  if (intel) {
    if (intel.guestTopics.includes("bezglutensko")) {
      reasonParts.push("pitali su za bezglutensko");
    } else if (intel.allergyLabels.length > 0) {
      reasonParts.push(`alergija: ${intel.allergyLabels.join(", ")}`);
    }

    if (intel.cartSummary) {
      reasonParts.push(`Cart: ${intel.cartSummary}`);
    } else if (intel.guestTopics.length > 0) {
      reasonParts.push(intel.guestTopics.slice(0, 2).join(", "));
    }
  }

  return reasonParts.join(" — ");
}
