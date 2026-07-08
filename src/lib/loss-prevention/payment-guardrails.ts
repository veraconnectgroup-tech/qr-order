/** ADR-044 S4 — payment invariance checks (no duplicate pay, balance truth). */

export type DuplicatePaymentCheck = {
  allowed: boolean;
  error?: string;
  status?: number;
  riskFlag?: boolean;
};

export type SessionCloseBalanceCheck = {
  allowed: boolean;
  error?: string;
  status?: number;
  requiresReason?: boolean;
  riskFlag?: boolean;
  openBalance?: number;
};

export function evaluateDuplicatePayment(input: {
  currentPaymentStatus: string;
  requestedAmount: number;
  openBalance: number;
}): DuplicatePaymentCheck {
  if (input.currentPaymentStatus === "paid") {
    return {
      allowed: false,
      error: "Bill is already paid — duplicate payment blocked.",
      status: 409,
      riskFlag: true,
    };
  }

  if (
    input.requestedAmount > 0 &&
    input.openBalance > 0 &&
    Math.abs(input.requestedAmount - input.openBalance) > 0.01 &&
    input.currentPaymentStatus === "processing"
  ) {
    return {
      allowed: false,
      error: "Payment amount does not match open balance.",
      status: 409,
      riskFlag: true,
    };
  }

  return { allowed: true };
}

export function evaluatePaidBelowBalance(input: {
  paymentStatus: string;
  paidAmount: number;
  openBalance: number;
  allowPartial?: boolean;
}): DuplicatePaymentCheck {
  if (input.paymentStatus !== "paid") {
    return { allowed: true };
  }

  if (input.allowPartial) {
    return { allowed: true };
  }

  if (input.paidAmount + 0.01 < input.openBalance) {
    return {
      allowed: false,
      error: "Paid amount is below open balance.",
      status: 409,
      riskFlag: true,
    };
  }

  return { allowed: true };
}

export function evaluateSessionCloseBalance(input: {
  openBalance: number;
  reason?: string | null;
}): SessionCloseBalanceCheck {
  if (Math.abs(input.openBalance) <= 0.01) {
    return { allowed: true, openBalance: 0 };
  }

  if (!input.reason?.trim()) {
    return {
      allowed: false,
      error: "Reason is required when closing a session with open balance.",
      status: 400,
      requiresReason: true,
      openBalance: input.openBalance,
    };
  }

  return {
    allowed: true,
    requiresReason: true,
    riskFlag: true,
    openBalance: input.openBalance,
  };
}

export function evaluateFailedPaymentPaidMismatch(input: {
  webhookStatus: string;
  orderPaymentStatus: string;
}): DuplicatePaymentCheck {
  if (
    input.webhookStatus === "failed" &&
    (input.orderPaymentStatus === "paid" || input.orderPaymentStatus === "processing")
  ) {
    return {
      allowed: false,
      error: "Card payment failed but order is marked paid — needs verification.",
      status: 409,
      riskFlag: true,
    };
  }

  return { allowed: true };
}
