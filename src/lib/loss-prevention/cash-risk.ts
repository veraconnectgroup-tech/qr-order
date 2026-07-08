import type { SupabaseClient } from "@supabase/supabase-js";

const CASH_PAYMENT_METHODS = new Set(["at_bar"]);
const MANAGER_ROLES = new Set(["owner", "manager"]);

export function isCashPaymentMethod(paymentMethod: string): boolean {
  return CASH_PAYMENT_METHODS.has(paymentMethod);
}

/** Location has active KassenSichV registration — cash needs fiscal reference. */
export async function locationRequiresFiscalReceipt(
  admin: SupabaseClient,
  locationId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("fiscal_registrations")
    .select("id")
    .eq("location_id", locationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

export type CashFiscalRiskInput = {
  paymentMethod: string;
  tseSignature: string | null;
  fiscalRequired: boolean;
};

export type CashFiscalRiskResult = {
  riskFlag: boolean;
  reason: string | null;
};

/** ADR-044 S5 — cash paid without fiscal receipt on fiskalizovanoj lokaciji. */
export function evaluateCashPaidWithoutFiscal(
  input: CashFiscalRiskInput
): CashFiscalRiskResult {
  if (!isCashPaymentMethod(input.paymentMethod) || !input.fiscalRequired) {
    return { riskFlag: false, reason: null };
  }

  if (input.tseSignature) {
    return { riskFlag: false, reason: null };
  }

  return {
    riskFlag: true,
    reason: "Cash payment without fiscal receipt reference — needs verification.",
  };
}

export type CashRefundGuardInput = {
  paymentMethod: string;
  reason: string;
  actorRole: string;
  isSystemActor?: boolean;
};

export type CashRefundGuardResult =
  | { allowed: true; riskFlag?: boolean }
  | { allowed: false; error: string; status: number };

/** ADR-044 S5 — cash refund/storno requires reason + manager (not system/webhook actor). */
export function evaluateCashRefundGuard(
  input: CashRefundGuardInput
): CashRefundGuardResult {
  if (!isCashPaymentMethod(input.paymentMethod) || input.isSystemActor) {
    return { allowed: true };
  }

  if (!input.reason?.trim()) {
    return {
      allowed: false,
      error: "Reason is required for cash refund/storno.",
      status: 400,
    };
  }

  if (!MANAGER_ROLES.has(input.actorRole)) {
    return {
      allowed: false,
      error: "Manager approval is required for cash refund/storno.",
      status: 403,
    };
  }

  return { allowed: true, riskFlag: true };
}

export type OpenCashSessionRow = {
  sessionId: string;
  locationId: string;
  tableName: string | null;
  openedAt: string;
  openBalance: number;
  oldestUnpaidAt: string;
};
