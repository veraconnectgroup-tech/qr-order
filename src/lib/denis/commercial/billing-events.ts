/** Billing timeline + outbox payloads (ADR-009 §5). */

export { DENIS_AI_LOW_BALANCE_THRESHOLD as AI_LOW_BALANCE_THRESHOLD } from "@/lib/constants";

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
