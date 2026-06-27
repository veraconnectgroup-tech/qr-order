import {
  auditRetentionDays,
  type AllergyAuditDetail,
  type DenisAuditEntry,
} from "@/lib/denis/compliance/audit-trail";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PersistDenisAuditInput = {
  orgId: string;
  locationId: string;
  tableSessionId?: string | null;
  guestTokenHash?: string | null;
  entry: DenisAuditEntry;
  allergyDetail?: AllergyAuditDetail | null;
  retentionDays?: number;
};

function retentionExpiresAt(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** Async compliance write — must not block Denis turn latency. */
export async function persistDenisAuditEntry(
  admin: SupabaseClient,
  input: PersistDenisAuditInput
): Promise<void> {
  const retention = auditRetentionDays({
    allergyGuardTriggered: input.entry.allergyGuardTriggered,
    retentionDays: input.retentionDays,
  });

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
    expires_at: retentionExpiresAt(retention),
  } as never);

  if (error) {
    logger.warn("denis.audit.persist_failed", {
      locationId: input.locationId,
      turnId: input.entry.turnId,
      error: error.message,
    });
  }
}

export function scheduleDenisAuditEntry(
  admin: SupabaseClient,
  input: PersistDenisAuditInput
): void {
  void persistDenisAuditEntry(admin, input).catch((error) => {
    logger.warn("denis.audit.schedule_failed", {
      locationId: input.locationId,
      turnId: input.entry.turnId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
