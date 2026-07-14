/**
 * SLA watcher for denis_missions — same reminder/escalation shape as
 * bus-table-obligation.ts's escalateOverdueBusTableObligations, generalized
 * to any mission kind that sets sla_minutes. No mission draft sets one
 * today (guest_conduct_handoff is priority:"urgent" and notifies
 * immediately instead), so this finds zero rows in practice right now —
 * infrastructure ready for kitchen_question/rule_confirmation_needed
 * missions once those set an SLA.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { logger } from "@/lib/logger";
import type { MissionRow } from "@/lib/denis/missions/mission-types";

export async function escalateOverdueMissionsForLocation(
  admin: SupabaseClient,
  input: { locationId: string; nowMs?: number }
): Promise<{ reminders: number; escalations: number }> {
  const nowMs = input.nowMs ?? Date.now();

  const { data: openRows } = await admin
    .from("denis_missions")
    .select("*")
    .eq("location_id", input.locationId)
    .eq("status", "open")
    .not("sla_minutes", "is", null);

  const rows = (openRows ?? []) as MissionRow[];
  if (!rows.length) return { reminders: 0, escalations: 0 };

  let reminders = 0;
  let escalations = 0;

  for (const row of rows) {
    if (row.sla_minutes == null) continue;
    const createdAtMs = Date.parse(row.created_at);
    if (!Number.isFinite(createdAtMs)) continue;

    const ageMs = nowMs - createdAtMs;
    const slaMs = row.sla_minutes * 60_000;
    const sendReminder = ageMs >= slaMs && !row.reminder_sent_at;
    const sendEscalation = ageMs >= slaMs * 2 && !row.escalated_at;

    if (sendReminder) {
      await dispatchStaffNotification({
        orgId: row.org_id,
        locationId: row.location_id,
        type: "denis_escalation",
        tableId: row.table_id ?? undefined,
        assignedWaiterId: row.assigned_staff_id,
        message: `${row.title} — čeka duže od ${row.sla_minutes} min.`,
      }).catch(() => undefined);

      await admin
        .from("denis_missions")
        .update({ reminder_sent_at: new Date(nowMs).toISOString() })
        .eq("id", row.id);
      reminders += 1;
    }

    if (sendEscalation) {
      await dispatchStaffNotification({
        orgId: row.org_id,
        locationId: row.location_id,
        type: "denis_escalation",
        priorityOverride: "urgent",
        tableId: row.table_id ?? undefined,
        message: `HITNO: ${row.title} — čeka duže od ${row.sla_minutes * 2} min, niko nije preuzeo.`,
      }).catch(() => undefined);

      await admin
        .from("denis_missions")
        .update({ escalated_at: new Date(nowMs).toISOString() })
        .eq("id", row.id);
      escalations += 1;
    }
  }

  return { reminders, escalations };
}

/** Watcher entry — escalate overdue missions for all locations with open, SLA-bound rows. */
export async function escalateAllOverdueMissions(
  admin: SupabaseClient,
  nowMs?: number
): Promise<{ reminders: number; escalations: number }> {
  const { data: openRows } = await admin
    .from("denis_missions")
    .select("location_id")
    .eq("status", "open")
    .not("sla_minutes", "is", null);

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
    try {
      const result = await escalateOverdueMissionsForLocation(admin, {
        locationId,
        nowMs,
      });
      reminders += result.reminders;
      escalations += result.escalations;
    } catch (error) {
      logger.warn("escalateOverdueMissionsForLocation failed", {
        locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { reminders, escalations };
}
