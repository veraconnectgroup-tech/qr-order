/** Billing timeline + outbox payloads (ADR-009 §5). */

export type BillingTurnDebitedPayload = {
  type: "billing.turn_debited";
  amount: number;
  balanceAfter: number;
  traceId: string;
};

export type BillingLowBalancePayload = {
  type: "billing.low_balance";
  orgId: string;
  balance: number;
  threshold: number;
  traceId?: string;
};

export type BillingCreditsPurchasedPayload = {
  type: "billing.credits_purchased";
  amount: number;
  balanceAfter: number;
  source: "stripe" | "manual";
  referenceId?: string;
};

export const BILLING_EVENT_TYPES = {
  turnDebited: "billing.turn_debited",
  lowBalance: "billing.low_balance",
  creditsPurchased: "billing.credits_purchased",
} as const;

/** Balance at or below this triggers outbox `billing.low_balance` (F4). */
export const AI_LOW_BALANCE_THRESHOLD = 10;
