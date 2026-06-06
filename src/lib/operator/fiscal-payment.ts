import { isCashPaymentMethod } from "@/lib/fiscal/daily-closing";

export type OperatorPaymentBucket = "cash" | "card" | "online" | "other";

/** Viktor-friendly payment bucket from orders.payment_method. */
export function normalizeOperatorPaymentMethod(
  paymentMethod: string | null | undefined
): OperatorPaymentBucket {
  const method = paymentMethod?.trim() ?? "unset";

  if (isCashPaymentMethod(method)) {
    return "cash";
  }

  if (
    method === "online" ||
    method === "pos_online" ||
    method === "pos"
  ) {
    return "online";
  }

  if (method === "card_terminal" || method === "card_at_table") {
    return "card";
  }

  return "other";
}
