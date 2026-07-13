/**
 * Generalized staff task system (Architecture Proposal §9) — generalizes
 * table_bus_obligations (bus-table-obligation.ts) so one table serves
 * handoffs, rule-confirmation nudges, and future arbitrary staff tasks
 * without a schema migration per new mission type. Same idempotent
 * "already an open one" guard, same read-then-guarded-update completion
 * shape as that module.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { MissionDraft, MissionRow } from "@/lib/denis/missions/mission-types";

export async function createMission(
  admin: SupabaseClient,
  draft: MissionDraft
): Promise<
  | { created: true; mission: MissionRow }
  | { created: false; reason: "already_open" | "insert_failed" }
> {
  if (draft.aiSessionId) {
    const { data: existing } = await admin
      .from("denis_missions")
      .select("id")
      .eq("ai_session_id", draft.aiSessionId)
      .eq("kind", draft.kind)
      .eq("status", "open")
      .maybeSingle();

    if (existing) return { created: false, reason: "already_open" };
  }

  const { data, error } = await admin
    .from("denis_missions")
    .insert({
      org_id: draft.orgId,
      location_id: draft.locationId,
      kind: draft.kind,
      status: "open",
      assigned_staff_id: draft.assignedStaffId ?? null,
      assigned_role: draft.assignedRole ?? null,
      table_id: draft.tableId ?? null,
      ai_session_id: draft.aiSessionId ?? null,
      title: draft.title,
      summary: draft.summary,
      payload: draft.payload ?? {},
      priority: draft.priority ?? "normal",
      sla_minutes: draft.slaMinutes ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    logger.warn("createMission failed", {
      kind: draft.kind,
      aiSessionId: draft.aiSessionId,
      error: error?.message,
    });
    return { created: false, reason: "insert_failed" };
  }

  return { created: true, mission: data as MissionRow };
}
