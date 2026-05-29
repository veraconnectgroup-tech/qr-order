export function mapFiscalPaymentType(
  paymentMethod: string
): "CASH" | "NON_CASH" {
  if (
    paymentMethod === "online" ||
    paymentMethod === "card_at_table" ||
    paymentMethod === "card_terminal" ||
    paymentMethod === "pos_online"
  ) {
    return "NON_CASH";
  }

  return "CASH";
}
