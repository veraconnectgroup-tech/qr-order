import {
  BILLING_EVENT_TYPES,
  type BillingCreditsPurchasedPayload,
} from "@/lib/denis/commercial/billing-events";
import { ensureOrgAiOpsQStashSchedule } from "@/lib/denis/commercial/ensure-org-ops-schedule";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplyCreditPurchaseInput = {
  orgId: string;
  amount: number;
  source: BillingCreditsPurchasedPayload["source"];
  referenceId?: string;
  packageId?: string;
};

export type ApplyCreditPurchaseResult =
  | { ok: true; balanceAfter: number }
  | { ok: false; code: "invalid_amount" | "add_failed" | "record_failed" };

/** Stripe / manual top-up — credits + org billing event + ops projection (ADR-009 F7). */
export async function applyCreditPurchase(
  admin: SupabaseClient,
  input: ApplyCreditPurchaseInput
): Promise<ApplyCreditPurchaseResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, code: "invalid_amount" };
  }

  const { data: newBalance, error: addError } = await admin.rpc(
    "add_ai_credits",
    {
      p_org_id: input.orgId,
      p_amount: input.amount,
    }
  );

  if (addError) {
    logger.error("applyCreditPurchase add_ai_credits failed", {
      orgId: input.orgId,
      amount: input.amount,
      error: addError.message,
    });
    return { ok: false, code: "add_failed" };
  }

  const balanceAfter = newBalance as number;
  const payload: BillingCreditsPurchasedPayload = {
    type: BILLING_EVENT_TYPES.creditsPurchased,
    amount: input.amount,
    balanceAfter,
    source: input.source,
    referenceId: input.referenceId,
  };

  const { error: eventError } = await admin.from("org_billing_events").insert({
    org_id: input.orgId,
    event_type: BILLING_EVENT_TYPES.creditsPurchased,
    payload: {
      ...payload,
      packageId: input.packageId ?? null,
    },
    reference_id: input.referenceId ?? null,
  });

  if (eventError) {
    logger.error("applyCreditPurchase org_billing_events insert failed", {
      orgId: input.orgId,
      error: eventError.message,
    });
    return { ok: false, code: "record_failed" };
  }

  const { error: refreshError } = await admin.rpc("refresh_org_ai_ops", {
    p_org_id: input.orgId,
  });

  if (refreshError) {
    logger.warn("applyCreditPurchase refresh_org_ai_ops failed", {
      orgId: input.orgId,
      error: refreshError.message,
    });
  } else {
    ensureOrgAiOpsQStashSchedule();
  }

  return { ok: true, balanceAfter };
}
