import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { logger } from "@/lib/logger";
import { createMission } from "@/lib/denis/missions/create-mission";

export type DenisCommitmentRow =
  Database["public"]["Tables"]["denis_commitments"]["Row"];

export type CreateCommitmentResult =
  | { created: true; commitment: DenisCommitmentRow }
  | { created: false; reason: "insert_failed" };

/**
 * Something Denis told staff he'd do, with a due date — "javicu sutra",
 * "prekosutra cu proveriti". Not shift-scoped (see migration comment):
 * a promise can span multiple days, so it stays open until its due date
 * comes and goes, not until the day ends.
 */
export async function createCommitment(
  admin: SupabaseClient,
  input: {
    locationId: string;
    text: string;
    dueDate: string;
    station: "kitchen" | "bar" | null;
    promisedToStaffId: string | null;
  }
): Promise<CreateCommitmentResult> {
  const { data: inserted, error } = await admin
    .from("denis_commitments")
    .insert({
      location_id: input.locationId,
      text: input.text,
      due_date: input.dueDate,
      station: input.station,
      promised_to_staff_id: input.promisedToStaffId,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    logger.warn("createCommitment insert failed", {
      locationId: input.locationId,
      error: error?.message,
    });
    return { created: false, reason: "insert_failed" };
  }

  return { created: true, commitment: inserted as DenisCommitmentRow };
}

/** Open commitments due today or earlier (overdue) — what Denis should proactively know about, not something he has to remember to ask for. */
export async function listDueCommitments(
  admin: SupabaseClient,
  input: { locationId: string; today: string }
): Promise<DenisCommitmentRow[]> {
  const { data, error } = await admin
    .from("denis_commitments")
    .select("*")
    .eq("location_id", input.locationId)
    .eq("status", "open")
    .lte("due_date", input.today)
    .order("due_date", { ascending: true });

  if (error) return [];
  return (data ?? []) as DenisCommitmentRow[];
}

export async function completeCommitment(
  admin: SupabaseClient,
  input: { commitmentId: string }
): Promise<boolean> {
  const { error } = await admin
    .from("denis_commitments")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", input.commitmentId)
    .eq("status", "open");

  return !error;
}

/** All open commitments due today or earlier, across every location — the scheduler tick's own state to survey, not scoped to one guest session. */
async function listAllDueCommitments(
  admin: SupabaseClient,
  today: string
): Promise<DenisCommitmentRow[]> {
  const { data, error } = await admin
    .from("denis_commitments")
    .select("*")
    .eq("status", "open")
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  if (error) return [];
  return (data ?? []) as DenisCommitmentRow[];
}

async function hasOpenCommitmentMission(
  admin: SupabaseClient,
  commitmentId: string
): Promise<boolean> {
  const { data } = await admin
    .from("denis_missions")
    .select("id")
    .eq("status", "open")
    .eq("kind", "custom")
    .contains("payload", { commitmentId })
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Denis's own follow-up on a promise he made ("javicu sutra") — closes the
 * gap where a due commitment only ever surfaced passively, the next time
 * someone happened to start a new voice session. Called from the scheduler
 * cron tick (no guest/staff turn triggers this) so a promise gets checked
 * on even if nobody calls Denis back. Idempotent per commitment via the
 * payload.commitmentId guard above — safe to call every tick.
 */
export async function checkAndCreateDueCommitmentMissions(
  admin: SupabaseClient,
  input: { today: string }
): Promise<{ checked: number; created: number }> {
  const due = await listAllDueCommitments(admin, input.today);
  let created = 0;

  for (const commitment of due) {
    if (await hasOpenCommitmentMission(admin, commitment.id)) continue;

    const { data: locationRow } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", commitment.location_id)
      .maybeSingle();
    const orgId = (locationRow as { org_id: string } | null)?.org_id;
    if (!orgId) continue;

    const result = await createMission(admin, {
      kind: "custom",
      orgId,
      locationId: commitment.location_id,
      title: "Denis's commitment is due",
      summary: commitment.text,
      payload: { commitmentId: commitment.id, dueDate: commitment.due_date },
      assignedStaffId: commitment.promised_to_staff_id,
      assignedRole:
        commitment.station === "kitchen" || commitment.station === "bar"
          ? commitment.station
          : null,
      priority: "normal",
    });

    if (result.created) created += 1;
  }

  return { checked: due.length, created };
}
