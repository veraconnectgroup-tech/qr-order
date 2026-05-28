import { AI_CONFIG } from "@/lib/ai/config";
import { BILLING_EVENT_TYPES } from "@/lib/denis/commercial/billing-events";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MeteringResult =
  | { ok: true; balanceAfter: number }
  | { ok: false; code: "insufficient_credits" | "finalize_failed" };

export function creditsPerTurn(): number {
  return AI_CONFIG.creditsPerMessage;
}

/** Pre-flight balance check before LLM (fail fast). */
export async function assertSufficientCredits(
  admin: SupabaseClient,
  orgId: string,
  amount = creditsPerTurn()
): Promise<MeteringResult> {
  const { data: creditsRow } = await admin
    .from("ai_credits")
    .select("balance")
    .eq("org_id", orgId)
    .maybeSingle();

  const balance = (creditsRow as { balance: number } | null)?.balance ?? 0;
  if (balance < amount) {
    return { ok: false, code: "insufficient_credits" };
  }
  return { ok: true, balanceAfter: balance };
}

/**
 * Atomic debit + billing timeline event + session credits_used (ADR-009 F2).
 * Migration: `finalize_denis_turn_metering`.
 */
export async function finalizeTurnMetering(
  admin: SupabaseClient,
  input: {
    orgId: string;
    aiSessionId: string;
    traceId: string;
    amount?: number;
  }
): Promise<MeteringResult> {
  const amount = input.amount ?? creditsPerTurn();

  const { data: newBalance, error } = await admin.rpc(
    "finalize_denis_turn_metering",
    {
      p_org_id: input.orgId,
      p_ai_session_id: input.aiSessionId,
      p_amount: amount,
      p_trace_id: input.traceId,
      p_payload: {
        type: BILLING_EVENT_TYPES.turnDebited,
        amount,
        traceId: input.traceId,
      },
    }
  );

  if (error) {
    logger.error("finalize_denis_turn_metering failed", {
      orgId: input.orgId,
      aiSessionId: input.aiSessionId,
      traceId: input.traceId,
      error: error.message,
    });
    return { ok: false, code: "finalize_failed" };
  }

  if (newBalance === -1) {
    return { ok: false, code: "insufficient_credits" };
  }

  return { ok: true, balanceAfter: newBalance as number };
}
