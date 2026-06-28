import type { StaffAction } from "@/lib/denis/venue/copilot/generate-staff-actions";

type StaffProactiveAlertInput = {
  kind: string;
  message: string;
  tableName: string;
};

/** Map Denis staff proactive alert → copilot suggested action (M15). */
export function staffProactiveAlertToCopilotAction(
  alert: StaffProactiveAlertInput
): StaffAction | null {
  switch (alert.kind) {
    case "staff_frustrated_guest":
    case "staff_low_experience":
      return {
        suggestedAction: alert.message,
        actionPriority: "urgent",
        revenueOpportunity: null,
        guestWaitMinutes: null,
        estimatedRemainingMinutes: null,
      };
    case "staff_attention_escalation":
      return {
        suggestedAction: alert.message,
        actionPriority: "urgent",
        revenueOpportunity: null,
        guestWaitMinutes: null,
        estimatedRemainingMinutes: null,
      };
    case "staff_table_idle":
      return {
        suggestedAction: `Provjeri sto ${alert.tableName} — nema narudžbine`,
        actionPriority: "normal",
        revenueOpportunity: null,
        guestWaitMinutes: null,
        estimatedRemainingMinutes: null,
      };
    case "staff_waiter_request":
      return {
        suggestedAction: `Sto ${alert.tableName} traži konobara`,
        actionPriority: "high",
        revenueOpportunity: null,
        guestWaitMinutes: null,
        estimatedRemainingMinutes: null,
      };
    case "staff_allergy":
      return {
        suggestedAction: alert.message,
        actionPriority: "urgent",
        revenueOpportunity: null,
        guestWaitMinutes: null,
        estimatedRemainingMinutes: null,
      };
    case "staff_storno_suggestion":
      return {
        suggestedAction: alert.message,
        actionPriority: "high",
        revenueOpportunity: null,
        guestWaitMinutes: null,
        estimatedRemainingMinutes: null,
      };
    default:
      return null;
  }
}

/** Prefer explicit frustration staff hints from Denis recovery path. */
export function copilotActionFromStaffHint(
  tableName: string,
  hintText: string | null | undefined
): StaffAction | null {
  const text = hintText?.trim();
  if (!text) return null;
  if (!/frustriran/i.test(text)) return null;

  return {
    suggestedAction: `Pređi na sto ${tableName}`,
    actionPriority: "urgent",
    revenueOpportunity: null,
    guestWaitMinutes: null,
    estimatedRemainingMinutes: null,
  };
}
