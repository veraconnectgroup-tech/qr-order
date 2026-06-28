import {
  formatAllergyAuditBlock,
  type AllergyAuditDetail,
  type DenisAuditEntry,
} from "@/lib/denis/compliance/audit-trail";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuditRow = {
  turn_id: string;
  session_id: string | null;
  recorded_at: string;
  guest_input_hash: string;
  denis_response: string;
  decision_path: string[] | null;
  data_accessed: string[] | null;
  allergy_guard_triggered: boolean;
  order_submitted: boolean;
  credits_cost: number | string;
  model: string | null;
  latency_ms: number | null;
  allergy_detail: AllergyAuditDetail | null;
  guest_token_hash: string | null;
};

export type DenisAuditTrailSnapshot = {
  periodDays: number;
  turnCount: number;
  allergyEventCount: number;
  orderSubmitCount: number;
  recentEntries: Array<DenisAuditEntry & { recordedAt: string }>;
  allergyAuditBlock: string;
};

export async function loadDenisAuditTrailSnapshot(
  admin: SupabaseClient,
  input: { locationId: string; periodDays?: number; limit?: number }
): Promise<DenisAuditTrailSnapshot> {
  const periodDays = input.periodDays ?? 7;
  const since = new Date(Date.now() - periodDays * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("denis_audit_entries" as never)
    .select(
      "turn_id, session_id, recorded_at, guest_input_hash, denis_response, decision_path, data_accessed, allergy_guard_triggered, order_submitted, credits_cost, model, latency_ms, allergy_detail, guest_token_hash"
    )
    .eq("location_id", input.locationId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(input.limit ?? 200);

  if (error) {
    return {
      periodDays,
      turnCount: 0,
      allergyEventCount: 0,
      orderSubmitCount: 0,
      recentEntries: [],
      allergyAuditBlock: "Audit trail unavailable.",
    };
  }

  const rows = (data ?? []) as AuditRow[];

  const recentEntries = rows.map((row) => ({
    turnId: row.turn_id,
    sessionId: row.session_id ?? "unknown",
    timestamp: row.recorded_at,
    recordedAt: row.recorded_at,
    guestInputHash: row.guest_input_hash,
    denisResponse: row.denis_response,
    decisionPath: row.decision_path ?? [],
    dataAccessed: row.data_accessed ?? [],
    allergyGuardTriggered: row.allergy_guard_triggered,
    orderSubmitted: row.order_submitted,
    creditsCost: Number(row.credits_cost ?? 0),
    model: row.model ?? "unknown",
    latencyMs: row.latency_ms ?? 0,
  }));

  const allergyRows = rows
    .filter((row) => row.allergy_detail)
    .map((row) => ({
      recordedAt: row.recorded_at,
      turnId: row.turn_id,
      detail: row.allergy_detail as AllergyAuditDetail,
    }));

  return {
    periodDays,
    turnCount: rows.length,
    allergyEventCount: rows.filter((row) => row.allergy_guard_triggered).length,
    orderSubmitCount: rows.filter((row) => row.order_submitted).length,
    recentEntries,
    allergyAuditBlock: formatAllergyAuditBlock(allergyRows),
  };
}

export async function loadDenisAuditTrailForGuestExport(
  admin: SupabaseClient,
  input: {
    locationId: string;
    guestTokenHash: string;
    limit?: number;
  }
): Promise<Array<DenisAuditEntry & { recordedAt: string }>> {
  const { data } = await admin
    .from("denis_audit_entries" as never)
    .select(
      "turn_id, session_id, recorded_at, guest_input_hash, denis_response, decision_path, data_accessed, allergy_guard_triggered, order_submitted, credits_cost, model, latency_ms"
    )
    .eq("location_id", input.locationId)
    .eq("guest_token_hash", input.guestTokenHash)
    .order("recorded_at", { ascending: false })
    .limit(input.limit ?? 500);

  return ((data ?? []) as AuditRow[]).map((row) => ({
    turnId: row.turn_id,
    sessionId: row.session_id ?? "unknown",
    timestamp: row.recorded_at,
    recordedAt: row.recorded_at,
    guestInputHash: row.guest_input_hash,
    denisResponse: row.denis_response,
    decisionPath: row.decision_path ?? [],
    dataAccessed: row.data_accessed ?? [],
    allergyGuardTriggered: row.allergy_guard_triggered,
    orderSubmitted: row.order_submitted,
    creditsCost: Number(row.credits_cost ?? 0),
    model: row.model ?? "unknown",
    latencyMs: row.latency_ms ?? 0,
  }));
}
