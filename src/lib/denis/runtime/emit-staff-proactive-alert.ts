import type { StaffProactiveAlert } from "@/lib/denis/cognition/proactive/proactive-types";
import {
  actionUrlForStaffProactiveAlert,
  priorityForStaffProactiveAlert,
  shouldPlayStaffAlertSound,
} from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { mapStaffProactiveAlertToNotificationType } from "@/lib/denis/notifications/staff-notifications";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

async function resolveLocationOrgId(
  admin: SupabaseClient,
  locationId: string
): Promise<string | null> {
  const { data } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .maybeSingle();

  return (data as { org_id?: string } | null)?.org_id ?? null;
}

export async function emitStaffProactiveAlert(
  admin: SupabaseClient,
  input: {
    locationId: string;
    orgId?: string;
    aiSessionId: string;
    tableId: string;
    alert: StaffProactiveAlert;
    orderId?: string | null;
    traceId?: string;
  }
): Promise<void> {
  const traceId = input.traceId ?? createTurnTraceId();

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "staff.proactive.alert",
    traceId,
    payload: {
      type: "staff.proactive.alert",
      audience: "staff",
      kind: input.alert.kind,
      message: input.alert.message,
      tableName: input.alert.tableName,
      detail: input.alert.detail ?? null,
      orderId: input.orderId ?? null,
      dedupeKey: input.alert.kind,
      source: "session.watcher",
    },
  });

  const orgId = input.orgId ?? (await resolveLocationOrgId(admin, input.locationId));
  const result = await dispatchStaffNotification({
    orgId: orgId ?? undefined,
    locationId: input.locationId,
    type: mapStaffProactiveAlertToNotificationType(input.alert.kind),
    message: input.alert.message,
    tableId: input.tableId,
    tableName: input.alert.tableName,
    actionUrl: actionUrlForStaffProactiveAlert({
      kind: input.alert.kind,
      tableId: input.tableId,
    }),
    priorityOverride: priorityForStaffProactiveAlert(input.alert.kind),
    playSound: shouldPlayStaffAlertSound(input.alert.kind),
  });

  logger.info("Staff proactive alert delivered", {
    locationId: input.locationId,
    tableId: input.tableId,
    kind: input.alert.kind,
    delivered: result.delivered,
  });
}
