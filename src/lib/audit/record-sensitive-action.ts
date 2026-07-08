import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SensitiveAction,
  SensitiveActionContext,
  SensitiveTargetType,
} from "@/lib/audit/sensitive-action-types";

export type RecordSensitiveActionInput = {
  orderId?: string | null;
  sessionId?: string | null;
  action: SensitiveAction;
  targetType?: SensitiveTargetType;
  targetId?: string | null;
  actorStaffId?: string;
  actorType?: "staff" | "guest" | "system";
  actorId?: string | null;
  reason?: string | null;
  approvedByStaffId?: string | null;
  riskFlag?: boolean;
  context?: SensitiveActionContext;
  idempotencyKey?: string | null;
};

export type RecordSensitiveActionResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string };

function hasAnchor(input: RecordSensitiveActionInput): boolean {
  return Boolean(input.orderId ?? input.sessionId);
}

/** Append-only sensitive action journal — ADR-044 S1. */
export async function recordSensitiveAction(
  admin: SupabaseClient,
  input: RecordSensitiveActionInput
): Promise<RecordSensitiveActionResult> {
  if (!hasAnchor(input)) {
    const message = "Sensitive action requires orderId or sessionId.";
    logger.error("recordSensitiveAction missing anchor", {
      action: input.action,
      targetId: input.targetId,
    });
    return { ok: false, error: message };
  }

  const actorType = input.actorType ?? "staff";
  const actorId = input.actorId ?? input.actorStaffId ?? null;

  const row = {
    order_id: input.orderId ?? null,
    session_id: input.sessionId ?? null,
    event_type: input.action,
    sensitive_action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    reason: input.reason?.trim() ? input.reason.trim() : null,
    approved_by_staff_id: input.approvedByStaffId ?? null,
    risk_flag: input.riskFlag ?? false,
    context: input.context ?? {},
    payload: {
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      context: input.context ?? {},
    },
    actor_type: actorType,
    actor_id: actorId,
    idempotency_key: input.idempotencyKey ?? null,
  };

  const { data, error } = await admin
    .from("order_events")
    .insert(row as never)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505" && input.idempotencyKey) {
      const { data: existing } = await admin
        .from("order_events")
        .select("id")
        .eq("order_id", input.orderId ?? "")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();

      if (existing) {
        return { ok: true, eventId: (existing as { id: string }).id };
      }
    }

    logger.error("recordSensitiveAction insert failed", {
      action: input.action,
      orderId: input.orderId,
      sessionId: input.sessionId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }

  if (!data) {
    logger.error("recordSensitiveAction insert returned no row", {
      action: input.action,
      orderId: input.orderId,
      sessionId: input.sessionId,
    });
    return { ok: false, error: "Insert returned no row." };
  }

  return { ok: true, eventId: (data as { id: string }).id };
}
