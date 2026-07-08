import type { SupabaseClient } from "@supabase/supabase-js";
import type { SensitiveActionResolution } from "@/lib/audit/sensitive-action-types";

export type ResolveSuspiciousFlagInput = {
  eventId: string;
  staffId: string;
  outcome: SensitiveActionResolution;
};

export type ResolveSuspiciousFlagResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/** Mark suspicious flag reviewed — ADR-044 S7. */
export async function resolveSuspiciousFlag(
  admin: SupabaseClient,
  input: ResolveSuspiciousFlagInput
): Promise<ResolveSuspiciousFlagResult> {
  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await admin
    .from("order_events")
    .select("id, risk_flag, resolved_at")
    .eq("id", input.eventId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, error: "Flag not found.", status: 404 };
  }

  const row = existing as {
    id: string;
    risk_flag: boolean;
    resolved_at: string | null;
  };

  if (!row.risk_flag) {
    return { ok: false, error: "Event is not a risk flag.", status: 400 };
  }

  if (row.resolved_at) {
    return { ok: true };
  }

  const { error } = await admin
    .from("order_events")
    .update({
      resolved_at: now,
      resolved_outcome: input.outcome,
      resolved_by_staff_id: input.staffId,
    } as never)
    .eq("id", input.eventId);

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  return { ok: true };
}
