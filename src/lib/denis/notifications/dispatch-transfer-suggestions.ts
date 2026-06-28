import {
  transferSuggestionActionUrl,
  transferSuggestionStaffMessage,
  type TransferSuggestion,
} from "@/lib/denis/intelligence/table-transfer-advisor";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { buildStaffNotification } from "@/lib/denis/notifications/staff-notifications";

export function staffNotificationFromTransferSuggestion(
  suggestion: TransferSuggestion
): ReturnType<typeof buildStaffNotification> {
  return buildStaffNotification({
    type: "table_transfer",
    tableId: suggestion.fromTableId,
    tableName: suggestion.fromTableName,
    message: transferSuggestionStaffMessage(suggestion),
    actionUrl: transferSuggestionActionUrl(suggestion),
    priority:
      suggestion.reason === "reserved_incoming" ||
      suggestion.reason === "capacity_rebalance"
        ? "high"
        : "medium",
  });
}

export async function dispatchTransferSuggestions(input: {
  orgId: string;
  locationId: string;
  suggestions: TransferSuggestion[];
}): Promise<number> {
  let dispatched = 0;

  for (const suggestion of input.suggestions) {
    const notification = staffNotificationFromTransferSuggestion(suggestion);
    const result = await dispatchStaffNotification({
      orgId: input.orgId,
      locationId: input.locationId,
      type: notification.type,
      message: notification.message,
      tableId: notification.tableId,
      tableName: notification.tableName,
      actionUrl: notification.actionUrl,
      priorityOverride: notification.priority,
      playSound:
        notification.priority === "high" || notification.priority === "urgent",
    });

    if (result.delivered) dispatched += 1;
  }

  return dispatched;
}
