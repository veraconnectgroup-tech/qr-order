import type { CommerceCommandType, CommerceEventType } from "@/lib/commerce/event-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/types/database";

export type FinalizeCommerceCommandInput = {
  orgId: string;
  locationId: string;
  sessionId: string;
  orderId?: string | null;
  commandType: CommerceCommandType;
  eventType: CommerceEventType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  traceId?: string;
  schemaVersion?: number;
};

export type FinalizeCommerceCommandResult =
  | { ok: true; eventId: string }
  | {
      ok: false;
      code: "finalize_failed" | "feedback_already_submitted";
    };

export async function finalizeCommerceExperienceCommand(
  admin: SupabaseClient,
  input: FinalizeCommerceCommandInput
): Promise<FinalizeCommerceCommandResult> {
  const { data, error } = await admin.rpc("finalize_commerce_experience_command", {
    p_org_id: input.orgId,
    p_location_id: input.locationId,
    p_session_id: input.sessionId,
    p_order_id: input.orderId ?? null,
    p_command_type: input.commandType,
    p_event_type: input.eventType,
    p_payload: input.payload as Json,
    p_idempotency_key: input.idempotencyKey,
    p_trace_id: input.traceId ?? null,
    p_schema_version: input.schemaVersion ?? 1,
  });

  if (error) {
    if (
      error.code === "23505" ||
      error.message.includes("feedback_already_submitted")
    ) {
      return { ok: false, code: "feedback_already_submitted" };
    }

    logger.error("finalize_commerce_experience_command failed", {
      orgId: input.orgId,
      sessionId: input.sessionId,
      commandType: input.commandType,
      traceId: input.traceId,
      error: error.message,
    });
    return { ok: false, code: "finalize_failed" };
  }

  if (typeof data !== "string" || !data) {
    return { ok: false, code: "finalize_failed" };
  }

  return { ok: true, eventId: data };
}
