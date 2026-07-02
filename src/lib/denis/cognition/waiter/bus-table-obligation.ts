/**
 * ADR-043 S13 — bus_table obligation (ADR-032 spine + persisted floor task).
 */
import type { ConciergeTableTurnaround } from "@/lib/denis/config/concierge-config.schema";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import type { WaiterGapKind } from "@/lib/denis/cognition/waiter/waiter-obligation-types";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUS_TABLE_ESCALATION_PREFIX,
  isBusTableEscalationMessage,
} from "@/lib/denis/notifications/staff-notification-markers";
import { minutesSincePaid } from "@/lib/denis/cognition/waiter/bus-table-utils";

export const BUS_TABLE_GAP_KIND = "bus_table" as const satisfies WaiterGapKind;

export type TableBusObligationRow =
  Database["public"]["Tables"]["table_bus_obligations"]["Row"];

export { minutesSincePaid };

export function busTableWaiterPrompt(
  tableName: string,
  waitMinutes: number,
  language = "sr"
): string {
  const lang = language.slice(0, 2);
  if (lang === "de") {
    return `Tisch ${tableName} — bezahlt vor ${waitMinutes} Min, bitte abräumen.`;
  }
  if (lang === "en") {
    return `Table ${tableName} — paid ${waitMinutes} min ago, please bus.`;
  }
  return `Sto ${tableName} — plaćeno pre ${waitMinutes} min, raspremi sto.`;
}

export { isBusTableEscalationMessage, BUS_TABLE_ESCALATION_PREFIX };

async function loadSessionPaymentContext(
  admin: SupabaseClient,
  sessionId: string
): Promise<{
  locationId: string;
  tableId: string;
  tableName: string;
  assignedStaffId: string | null;
  orgId: string;
  aiSessionId: string | null;
  allPaid: boolean;
  paidAt: string | null;
} | null> {
  const { data: session } = await admin
    .from("table_sessions")
    .select(
      "id, location_id, table_id, denis_shared_ai_session_id, ended_at"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return null;

  const sessionRow = session as {
    location_id: string;
    table_id: string;
    denis_shared_ai_session_id: string | null;
  };

  const { data: orders } = await admin
    .from("orders")
    .select("payment_status, updated_at, delivered_at")
    .eq("session_id", sessionId);

  const orderRows = (orders ?? []) as Array<{
    payment_status: string;
    updated_at: string;
    delivered_at: string | null;
  }>;

  if (!orderRows.length) return null;

  const allPaid = orderRows.every((order) =>
    isPaidPaymentStatus(order.payment_status)
  );
  if (!allPaid) return null;

  const paidTimestamps = orderRows
    .map((order) => order.delivered_at ?? order.updated_at)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  const paidAt =
    paidTimestamps.length > 0
      ? new Date(Math.max(...paidTimestamps)).toISOString()
      : new Date().toISOString();

  const { data: table } = await admin
    .from("tables")
    .select("name, assigned_staff_id, location_id")
    .eq("id", sessionRow.table_id)
    .maybeSingle();

  if (!table) return null;

  const tableRow = table as {
    name: string;
    assigned_staff_id: string | null;
    location_id: string;
  };

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", tableRow.location_id)
    .maybeSingle();

  if (!location) return null;

  return {
    locationId: sessionRow.location_id,
    tableId: sessionRow.table_id,
    tableName: tableRow.name,
    assignedStaffId: tableRow.assigned_staff_id,
    orgId: (location as { org_id: string }).org_id,
    aiSessionId: sessionRow.denis_shared_ai_session_id,
    allPaid,
    paidAt,
  };
}

export async function createBusTableObligation(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
    sessionId: string;
    assignedStaffId: string | null;
    paidAt: string;
    config: ConciergeTableTurnaround;
    traceId?: string;
    aiSessionId?: string | null;
  }
): Promise<
  | { created: true; obligation: TableBusObligationRow }
  | { created: false; reason: "disabled" | "already_open" | "insert_failed" }
> {
  if (!input.config.enabled) {
    return { created: false, reason: "disabled" };
  }

  const { data: existing } = await admin
    .from("table_bus_obligations")
    .select("id")
    .eq("table_id", input.tableId)
    .eq("status", "open")
    .maybeSingle();

  if (existing) {
    return { created: false, reason: "already_open" };
  }

  const { data, error } = await admin
    .from("table_bus_obligations")
    .insert({
      location_id: input.locationId,
      table_id: input.tableId,
      session_id: input.sessionId,
      assigned_staff_id: input.assignedStaffId,
      status: "open",
      paid_at: input.paidAt,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    logger.warn("createBusTableObligation failed", {
      tableId: input.tableId,
      error: error?.message,
    });
    return { created: false, reason: "insert_failed" };
  }

  const obligation = data as TableBusObligationRow;

  if (input.aiSessionId) {
    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "floor.bus_table.opened",
      traceId: input.traceId ?? createTurnTraceId(),
      payload: {
        type: "floor.bus_table.opened",
        tableId: input.tableId,
        obligationId: obligation.id,
        gapKind: BUS_TABLE_GAP_KIND,
        paidAt: input.paidAt,
      },
    }).catch(() => undefined);
  }

  return { created: true, obligation };
}

/** Hook from payment_settled — create bus obligation when full session is paid. */
export async function maybeCreateBusTableObligationOnPaymentSettled(
  admin: SupabaseClient,
  input: { orderId: string; traceId?: string }
): Promise<{ created: boolean; reason?: string }> {
  const { data: order } = await admin
    .from("orders")
    .select("session_id")
    .eq("id", input.orderId)
    .maybeSingle();

  const sessionId = (order as { session_id: string | null } | null)?.session_id;
  if (!sessionId) {
    return { created: false, reason: "no_session" };
  }

  const ctx = await loadSessionPaymentContext(admin, sessionId);
  if (!ctx?.allPaid || !ctx.paidAt) {
    return { created: false, reason: "session_not_fully_paid" };
  }

  const config = await loadConciergeConfigForLocation(ctx.locationId);
  const result = await createBusTableObligation(admin, {
    locationId: ctx.locationId,
    tableId: ctx.tableId,
    sessionId,
    assignedStaffId: ctx.assignedStaffId,
    paidAt: ctx.paidAt,
    config: config.ops.tableTurnaround,
    traceId: input.traceId,
    aiSessionId: ctx.aiSessionId,
  });

  if (!result.created) {
    return { created: false, reason: result.reason };
  }

  await dispatchStaffNotification({
    orgId: ctx.orgId,
    locationId: ctx.locationId,
    type: "long_wait",
    tableId: ctx.tableId,
    tableName: ctx.tableName,
    message: busTableWaiterPrompt(ctx.tableName, 0, config.language.venueDefault),
    assignedWaiterId: ctx.assignedStaffId,
    actionUrl: `/waiter/tables/${ctx.tableId}`,
  }).catch(() => undefined);

  return { created: true };
}

export async function completeBusTableObligation(
  admin: SupabaseClient,
  input: {
    obligationId: string;
    staffId: string;
    traceId?: string;
  }
): Promise<
  | { ok: true; obligation: TableBusObligationRow }
  | { ok: false; error: "not_found" | "not_open" | "update_failed" }
> {
  const { data: row } = await admin
    .from("table_bus_obligations")
    .select("*")
    .eq("id", input.obligationId)
    .maybeSingle();

  if (!row) return { ok: false, error: "not_found" };

  const obligation = row as TableBusObligationRow;
  if (obligation.status !== "open") {
    return { ok: false, error: "not_open" };
  }

  const bussedAt = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("table_bus_obligations")
    .update({
      status: "bussed",
      bussed_at: bussedAt,
      bussed_by: input.staffId,
    })
    .eq("id", input.obligationId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    return { ok: false, error: "update_failed" };
  }

  const bussed = updated as TableBusObligationRow;

  if (bussed.session_id) {
    const { data: session } = await admin
      .from("table_sessions")
      .select("denis_shared_ai_session_id")
      .eq("id", bussed.session_id)
      .maybeSingle();

    const aiSessionId = (session as { denis_shared_ai_session_id: string | null } | null)
      ?.denis_shared_ai_session_id;

    if (aiSessionId) {
      await appendDenisTimelineEvent(admin, {
        aiSessionId,
        eventType: "floor.bus_table.bussed",
        traceId: input.traceId ?? createTurnTraceId(),
        payload: {
          type: "floor.bus_table.bussed",
          tableId: bussed.table_id,
          obligationId: bussed.id,
          gapKind: BUS_TABLE_GAP_KIND,
          paidAt: bussed.paid_at,
          bussedAt,
        },
      }).catch(() => undefined);
    }
  }

  return { ok: true, obligation: bussed };
}

export async function escalateOverdueBusTableObligations(
  admin: SupabaseClient,
  input: {
    locationId: string;
    config: ConciergeTableTurnaround;
    nowMs?: number;
  }
): Promise<{ reminders: number; escalations: number }> {
  if (!input.config.enabled) {
    return { reminders: 0, escalations: 0 };
  }

  const nowMs = input.nowMs ?? Date.now();

  const { data: openRows } = await admin
    .from("table_bus_obligations")
    .select("id, table_id, paid_at, reminder_sent_at, escalated_at")
    .eq("location_id", input.locationId)
    .eq("status", "open");

  const rows = (openRows ?? []) as Array<{
    id: string;
    table_id: string;
    paid_at: string;
    reminder_sent_at: string | null;
    escalated_at: string | null;
  }>;

  if (!rows.length) {
    return { reminders: 0, escalations: 0 };
  }

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", input.locationId)
    .maybeSingle();

  const orgId = (location as { org_id: string } | null)?.org_id;

  let reminders = 0;
  let escalations = 0;

  for (const row of rows) {
    const paidAtMs = Date.parse(row.paid_at);
    if (!Number.isFinite(paidAtMs)) continue;

    const gates = resolveBusTableEscalationState({
      paidAt: row.paid_at,
      reminderSentAt: row.reminder_sent_at,
      escalatedAt: row.escalated_at,
      busSlaMinutes: input.config.busSlaMinutes,
      nowMs,
    });
    const waitMinutes = Math.floor((nowMs - paidAtMs) / 60_000);

    const { data: table } = await admin
      .from("tables")
      .select("name, assigned_staff_id")
      .eq("id", row.table_id)
      .maybeSingle();

    const tableName =
      (table as { name: string; assigned_staff_id: string | null } | null)?.name ??
      "Sto";
    const assignedStaffId =
      (table as { assigned_staff_id: string | null } | null)?.assigned_staff_id ??
      null;

    if (gates.sendReminder) {
      await dispatchStaffNotification({
        orgId: orgId ?? undefined,
        locationId: input.locationId,
        type: "long_wait",
        tableId: row.table_id,
        tableName,
        message: busTableWaiterPrompt(tableName, waitMinutes),
        assignedWaiterId: assignedStaffId,
        actionUrl: `/waiter/tables/${row.table_id}`,
      }).catch(() => undefined);

      await admin
        .from("table_bus_obligations")
        .update({ reminder_sent_at: new Date(nowMs).toISOString() })
        .eq("id", row.id);

      reminders += 1;
    }

    if (gates.sendEscalation) {
      await dispatchStaffNotification({
        orgId: orgId ?? undefined,
        locationId: input.locationId,
        type: "denis_escalation",
        priorityOverride: "urgent",
        tableId: row.table_id,
        tableName,
        message: `${BUS_TABLE_ESCALATION_PREFIX} ${tableName} neraspremljen ${waitMinutes} min posle plaćanja`,
        actionUrl: `/waiter/tables/${row.table_id}`,
      }).catch(() => undefined);

      await admin
        .from("table_bus_obligations")
        .update({ escalated_at: new Date(nowMs).toISOString() })
        .eq("id", row.id);

      escalations += 1;
    }
  }

  return { reminders, escalations };
}

export async function listOpenBusObligationsForLocation(
  admin: SupabaseClient,
  locationId: string
): Promise<TableBusObligationRow[]> {
  const { data } = await admin
    .from("table_bus_obligations")
    .select("*")
    .eq("location_id", locationId)
    .eq("status", "open")
    .order("paid_at", { ascending: true });

  return (data ?? []) as TableBusObligationRow[];
}

/** Watcher entry — escalate overdue bus obligations for all locations with open rows. */
export async function escalateAllOverdueBusTableObligations(
  admin: SupabaseClient,
  nowMs?: number
): Promise<{ reminders: number; escalations: number }> {
  const { data: openRows } = await admin
    .from("table_bus_obligations")
    .select("location_id")
    .eq("status", "open");

  const locationIds = [
    ...new Set(
      ((openRows ?? []) as Array<{ location_id: string }>).map(
        (row) => row.location_id
      )
    ),
  ];

  let reminders = 0;
  let escalations = 0;

  for (const locationId of locationIds) {
    const config = await loadConciergeConfigForLocation(locationId);
    const result = await escalateOverdueBusTableObligations(admin, {
      locationId,
      config: config.ops.tableTurnaround,
      nowMs,
    });
    reminders += result.reminders;
    escalations += result.escalations;
  }

  return { reminders, escalations };
}

export async function loadOpenBusObligationForTable(
  admin: SupabaseClient,
  tableId: string
): Promise<TableBusObligationRow | null> {
  const { data } = await admin
    .from("table_bus_obligations")
    .select("*")
    .eq("table_id", tableId)
    .eq("status", "open")
    .maybeSingle();

  return (data as TableBusObligationRow | null) ?? null;
}

export function turnaroundMinutesBetween(paidAt: string, bussedAt: string): number | null {
  const start = Date.parse(paidAt);
  const end = Date.parse(bussedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.round((end - start) / 60_000);
}

/** Pure SLA gates for watcher escalation (testable). */
export function resolveBusTableEscalationState(input: {
  paidAt: string;
  reminderSentAt: string | null;
  escalatedAt: string | null;
  busSlaMinutes: number;
  nowMs: number;
}): { sendReminder: boolean; sendEscalation: boolean } {
  const paidAtMs = Date.parse(input.paidAt);
  if (!Number.isFinite(paidAtMs)) {
    return { sendReminder: false, sendEscalation: false };
  }
  const ageMs = input.nowMs - paidAtMs;
  const slaMs = input.busSlaMinutes * 60_000;
  return {
    sendReminder: ageMs >= slaMs && !input.reminderSentAt,
    sendEscalation: ageMs >= slaMs * 2 && !input.escalatedAt,
  };
}
