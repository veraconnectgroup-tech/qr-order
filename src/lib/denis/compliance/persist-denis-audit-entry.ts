import {
  auditRetentionDays,
  buildAuditEntry,
  type AllergyAuditDetail,
  type DenisAuditEntry,
} from "@/lib/denis/compliance/audit-trail";
import { DAY_MS } from "@/lib/data-retention";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function persistDenisAuditEntry(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    tableSessionId?: string | null;
    guestTokenHash?: string | null;
    entry: DenisAuditEntry;
    allergyDetail?: AllergyAuditDetail | null;
  }
): Promise<boolean> {
  const retentionDays = auditRetentionDays({
    allergyGuardTriggered: input.entry.allergyGuardTriggered,
  });
  const expiresAt = new Date(
    Date.now() + retentionDays * DAY_MS
  ).toISOString();

  const { error } = await admin.from("denis_audit_entries" as never).insert({
    org_id: input.orgId,
    location_id: input.locationId,
    turn_id: input.entry.turnId,
    session_id: input.entry.sessionId,
    table_session_id: input.tableSessionId ?? null,
    guest_token_hash: input.guestTokenHash ?? null,
    recorded_at: input.entry.timestamp,
    guest_input_hash: input.entry.guestInputHash,
    denis_response: input.entry.denisResponse,
    decision_path: input.entry.decisionPath,
    data_accessed: input.entry.dataAccessed,
    allergy_guard_triggered: input.entry.allergyGuardTriggered,
    order_submitted: input.entry.orderSubmitted,
    credits_cost: input.entry.creditsCost,
    model: input.entry.model,
    latency_ms: input.entry.latencyMs,
    allergy_detail: input.allergyDetail ?? null,
    expires_at: expiresAt,
  } as never);

  if (error) {
    logger.warn("persistDenisAuditEntry failed", {
      locationId: input.locationId,
      turnId: input.entry.turnId,
      error: error.message,
    });
    return false;
  }

  return true;
}

export { buildAuditEntry };
