import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { logger } from "@/lib/logger";

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
