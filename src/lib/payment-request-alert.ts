import { formatPrice } from "@/lib/format";
import { inPersonPaymentCopy } from "@/lib/payment-methods";
import type { InPersonPaymentLocation } from "@/lib/constants";

export function staffPaymentRequestToast(input: {
  tableName: string;
  paymentMethod: string;
  total: number;
  currency: string;
  inPersonLocation?: InPersonPaymentLocation;
}) {
  const amount = formatPrice(input.total, input.currency);
  const table = input.tableName || "Table";

  if (input.paymentMethod === "online") {
    return `${table} — paying online (${amount})`;
  }
  if (input.paymentMethod === "card_at_table") {
    return `${table} — bring card terminal (${amount})`;
  }
  if (input.paymentMethod === "at_bar") {
    const where =
      inPersonPaymentCopy(input.inPersonLocation ?? "bar").shortLabel.toLowerCase();
    return `${table} — pay at ${where} (${amount})`;
  }

  return `${table} — payment requested (${amount})`;
}
