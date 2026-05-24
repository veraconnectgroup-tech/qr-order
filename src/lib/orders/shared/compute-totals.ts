import type { ValidatedLineItem } from "@/lib/orders/create/types";
import { calculateOrderTaxFromItems } from "@/lib/tax/vat";

export function computeSubtotal(lineItems: ValidatedLineItem[]): number {
  return lineItems.reduce((sum, item) => sum + item.itemTotal, 0);
}

export function computeOrderTaxTotals(
  lineItems: ValidatedLineItem[],
  orgDefaultTaxPercent: number
) {
  const taxPercent = Number(orgDefaultTaxPercent ?? 19);
  const subtotal = computeSubtotal(lineItems);
  const taxResult = calculateOrderTaxFromItems(
    lineItems.map((item) => ({
      lineTotal: item.itemTotal,
      taxRate: item.taxRate,
    }))
  );

  return {
    subtotal,
    taxAmount: taxResult.taxAmount,
    effectiveTaxPercent: taxResult.effectiveTaxPercent || taxPercent,
    total: taxResult.total,
  };
}

export function applyOrderDiscount(total: number, discountAmount: number): number {
  return Math.max(0, Math.round((total - discountAmount) * 100) / 100);
}
