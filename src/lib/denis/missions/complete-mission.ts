import type { SupabaseClient } from "@supabase/supabase-js";
import type { MissionRow } from "@/lib/denis/missions/mission-types";

export async function completeMission(
  admin: SupabaseClient,
  input: { missionId: string; staffId: string }
): Promise<
  | { ok: true; mission: MissionRow }
  | { ok: false; error: "not_found" | "not_open" | "update_failed" }
> {
  const { data: row } = await admin
    .from("denis_missions")
    .select("*")
    .eq("id", input.missionId)
    .maybeSingle();

  if (!row) return { ok: false, error: "not_found" };
  const mission = row as MissionRow;
  if (mission.status !== "open") return { ok: false, error: "not_open" };

  const { data: updated, error } = await admin
    .from("denis_missions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: input.staffId,
    })
    .eq("id", input.missionId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "update_failed" };
  return { ok: true, mission: updated as MissionRow };
}

export async function cancelMission(
  admin: SupabaseClient,
  input: { missionId: string; reason: string }
): Promise<
  | { ok: true; mission: MissionRow }
  | { ok: false; error: "not_found" | "not_open" | "update_failed" }
> {
  const { data: row } = await admin
    .from("denis_missions")
    .select("*")
    .eq("id", input.missionId)
    .maybeSingle();

  if (!row) return { ok: false, error: "not_found" };
  const mission = row as MissionRow;
  if (mission.status !== "open") return { ok: false, error: "not_open" };

  const { data: updated, error } = await admin
    .from("denis_missions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: input.reason,
    })
    .eq("id", input.missionId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "update_failed" };
  return { ok: true, mission: updated as MissionRow };
}
