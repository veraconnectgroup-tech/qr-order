export type PosPaymentState = "PAID" | "UNPAID";

export function resolvePosPaymentState(paymentStatus: string): PosPaymentState {
  return paymentStatus === "paid" ? "PAID" : "UNPAID";
}
