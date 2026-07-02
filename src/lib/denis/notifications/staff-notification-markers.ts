/** Stable message prefixes for Ops Center / shift report filtering (client-safe). */

export const SERVICE_RECOVERY_MESSAGE_PREFIX = "Recovery —";

export const BUS_TABLE_ESCALATION_PREFIX = "Obrt —";

export function isServiceRecoveryNotificationMessage(message: string): boolean {
  return message.trimStart().startsWith(SERVICE_RECOVERY_MESSAGE_PREFIX);
}

export function isBusTableEscalationMessage(message: string): boolean {
  return message.trimStart().startsWith(BUS_TABLE_ESCALATION_PREFIX);
}
