import type { GuestStatusIntel } from "@/lib/denis/stations/resolve-guest-status-intel";

function scenarioRead(intel: GuestStatusIntel): string {
  switch (intel.scenario) {
    case "no_open_order":
      return "No active guest order in fold — ask what they want or clarify politely.";
    case "bar_answered":
      return "Bar/kitchen already answered recently — use BAR_CONFIRMED facts; do not re-ask station.";
    case "just_placed":
      return "Order just sent (under ~2 min). Reassure: bar/kitchen received it and prep starts soon. No fake ETA.";
    case "in_progress":
      return "Order is actively being prepared at the station — say so warmly, no invented minutes.";
    case "ready_at_station":
      return "Items are ready at the pass — staff should bring them; guest should not wait much longer.";
    case "queue_busy":
      return "Venue is busy (see BAR LOAD). Acknowledge wait empathetically like a waiter — gužva, hvala na strpljenju — explain their order is queued, do NOT invent exact minutes.";
    case "needs_station_check":
      return "You cannot confirm timing alone — STATION_TICKET is opening. Tell guest you are checking with bar/kitchen personally; stay human, not robotic.";
    default:
      return "Answer from order facts only.";
  }
}

/** LLM truth block — Denis already checked load; speak like a waiter, not a countdown bot. */
export function buildGuestStatusSection(intel: GuestStatusIntel): string | null {
  if (intel.scenario === "no_open_order") {
    return [
      "GUEST STATUS CHECK (internal — you already looked):",
      "- No open order for this table in the live fold.",
      "- If guest insists they ordered, apologize for the mismatch and offer to check again — do not deny rudely.",
    ].join("\n");
  }

  const orderNumber =
    intel.primaryOrder?.orderNumber != null
      ? String(intel.primaryOrder.orderNumber)
      : "?";
  const station = intel.targetStation ?? "bar";
  const status = intel.primaryOrder?.status ?? "unknown";

  const lines = [
    "GUEST STATUS CHECK (internal — you already looked; answer like a personal waiter, NOT a bot):",
    `- Guest order #${orderNumber}: ${intel.itemsLabel || "items"} · status ${status} · ~${intel.waitMinutes} min ago`,
    `- Target station: ${station}`,
    `- BAR LOAD: ${intel.barActiveOrders} active drink orders${intel.barStress ? ` (${intel.barStress})` : ""}${intel.barAvgWaitMinutes != null ? ` · avg ~${intel.barAvgWaitMinutes} min at bar` : ""}`,
    `- KITCHEN LOAD: ${intel.kitchenActiveOrders} active food orders`,
    `- YOUR READ: ${scenarioRead(intel)}`,
    "- DO NOT quote exact minutes unless BAR_CONFIRMED is present below.",
    "- Tone: warm, apologetic when busy, first-person (\"Proveriću za vas\", \"Vidim da je gužva\").",
    `- STATION_TICKET: ${intel.needsStationTicket ? `opening — ping ${station} for exact status` : "not needed — answer from facts above"}`,
  ];

  if (intel.freshStationAnswer) {
    lines.push(
      `- BAR_CONFIRMED: ${intel.freshStationAnswer.station} answered ${intel.freshStationAnswer.answer}` +
        (intel.freshStationAnswer.etaMinutes
          ? ` · ${intel.freshStationAnswer.etaMinutes} min`
          : "") +
        ` · ${intel.freshStationAnswer.ageMinutes} min ago`
    );
  }

  return lines.join("\n");
}
