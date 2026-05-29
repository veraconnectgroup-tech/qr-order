import type { PosIntegrationContext } from "@/lib/outbox/types";
import { resolveFiscalBehavior } from "@/lib/fulfillment/resolve-fiscal-behavior";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";

export type FiscalMoment =
  | "payment_confirmed"
  | "cash_confirmed"
  | "pos_fiscal_export"
  | "never";

const IMMEDIATE_CASH_METHODS = new Set(["at_bar", "cash", "card_at_table"]);

export function resolveFiscalMoment(order: {
  paymentStatus: string;
  paymentMethod: string;
  status: string;
  posIntegration: PosIntegrationContext | null;
}): FiscalMoment {
  if (resolveFiscalBehavior(order.posIntegration) === "vorsystem") {
    return "pos_fiscal_export";
  }

  if (order.status === "rejected" || order.status === "cancelled") {
    return "never";
  }

  if (isPaidPaymentStatus(order.paymentStatus)) {
    return "payment_confirmed";
  }

  if (
    IMMEDIATE_CASH_METHODS.has(order.paymentMethod) &&
    order.paymentStatus === "pending"
  ) {
    return "cash_confirmed";
  }

  return "never";
}
