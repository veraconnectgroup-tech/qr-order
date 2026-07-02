import type { RecoveryAction } from "@/lib/denis/cognition/recovery/frustration-recovery";
import { resolveFrustrationStaffEscalation } from "@/lib/denis/cognition/recovery/frustration-recovery";
import {
  buildServiceRecoveryStaffMessage,
  extractRecentGuestMessages,
  suggestRecoveryGesture,
} from "@/lib/denis/cognition/recovery/build-service-recovery-alert";
import type { ServiceRecoveryTriggerResult } from "@/lib/denis/cognition/recovery/detect-service-recovery";
import type { StaffProactiveAlert } from "@/lib/denis/cognition/proactive/proactive-types";
import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { emitStaffProactiveAlert } from "@/lib/denis/runtime/emit-staff-proactive-alert";
import { logger } from "@/lib/logger";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

const FRUSTRATION_HINT = "Gost frustriran";

async function upsertFrustrationStaffHint(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
    text: string;
  }
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

  await admin
    .from("denis_staff_table_hints" as never)
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("location_id", input.locationId)
    .eq("table_id", input.tableId)
    .is("revoked_at", null);

  const { error } = await admin.from("denis_staff_table_hints" as never).insert({
    location_id: input.locationId,
    table_id: input.tableId,
    text: input.text,
    visibility: "denis_only",
    expires_at: expiresAt,
    created_by_staff_id: null,
  } as never);

  if (error) {
    logger.warn("Frustration staff hint upsert failed", {
      locationId: input.locationId,
      tableId: input.tableId,
      error: error.message,
    });
  }
}

function orderSummaryLine(
  orders: Array<{ orderNumber: number | null; status: string }>
): string | null {
  const open = orders.find(
    (order) =>
      order.status !== "delivered" &&
      order.status !== "cancelled" &&
      order.status !== "rejected"
  );
  if (!open) return null;
  const num = open.orderNumber != null ? `#${open.orderNumber}` : "porudžbina";
  return `Porudžbina ${num}: ${open.status}`;
}

/** Side effects for staff_escalation recovery — timeline alert + copilot hint (I1 / S12). */
export async function applyFrustrationRecoveryEscalation(
  admin: SupabaseClient,
  input: {
    actions: RecoveryAction[];
    config: ConciergeConfig;
    locationId: string;
    tableId: string;
    tableName: string;
    aiSessionId: string;
    sessionToken: string | null;
    traceId: string;
    language?: string;
    serviceRecovery?: ServiceRecoveryTriggerResult | null;
    timeline?: DenisTimelineRow[];
    openOrders?: Array<{ orderNumber: number | null; status: string }>;
  }
): Promise<{ waiterHandoff: boolean }> {
  const escalation = resolveFrustrationStaffEscalation(input.actions);
  if (!escalation) {
    return { waiterHandoff: false };
  }

  const serviceRecoveryEnabled =
    input.config.ops.serviceRecovery.enabled && input.serviceRecovery;

  let alert: StaffProactiveAlert;
  let hintText = FRUSTRATION_HINT;

  if (serviceRecoveryEnabled && input.serviceRecovery) {
    const gesture = suggestRecoveryGesture(
      input.config.ops.serviceRecovery,
      input.serviceRecovery.triggers,
      input.language ?? "sr"
    );
    const built = buildServiceRecoveryStaffMessage({
      tableName: input.tableName,
      language: input.language ?? "sr",
      triggers: input.serviceRecovery.triggers,
      complaintSnippet: input.serviceRecovery.complaintSnippet,
      waitMinutes: input.serviceRecovery.waitMinutes,
      recentGuestMessages: extractRecentGuestMessages(input.timeline ?? []),
      orderSummary: orderSummaryLine(input.openOrders ?? []),
      gesture,
    });
    alert = {
      kind: "staff_frustrated_guest",
      tableName: input.tableName,
      message: built.message,
      detail: built.detail,
    };
    hintText = "Recovery — nezadovoljan gost";

    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "service.recovery.opened",
      traceId: input.traceId,
      payload: {
        type: "service.recovery.opened",
        tableId: input.tableId,
        triggers: input.serviceRecovery.triggers,
        gesture,
        waitMinutes: input.serviceRecovery.waitMinutes,
        complaintSnippet: input.serviceRecovery.complaintSnippet,
        dedupeKey: `service_recovery:${input.tableId}`,
      },
    });
  } else {
    alert = {
      kind: "staff_frustrated_guest",
      tableName: input.tableName,
      message: `Pređi na sto ${input.tableName}`,
      detail: escalation.reason,
    };
  }

  await Promise.all([
    emitStaffProactiveAlert(admin, {
      locationId: input.locationId,
      aiSessionId: input.aiSessionId,
      tableId: input.tableId,
      alert,
      traceId: input.traceId,
    }),
    upsertFrustrationStaffHint(admin, {
      locationId: input.locationId,
      tableId: input.tableId,
      text: hintText,
    }),
  ]);

  let waiterHandoff = false;
  if (
    escalation.urgency === "urgent" &&
    input.config.handoff.waiterCall &&
    input.config.handoff.liveExecution &&
    input.sessionToken
  ) {
    const result = await executeDenisWaiterHandoff(admin, {
      tableId: input.tableId,
      locationId: input.locationId,
      tableToken: input.sessionToken,
      sessionToken: input.sessionToken,
    });
    waiterHandoff = result.ok;
  }

  return { waiterHandoff };
}
