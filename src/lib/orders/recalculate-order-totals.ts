import { applyOrderDiscount } from "@/lib/orders/shared/compute-totals";
import { calculateOrderTaxFromItems } from "@/lib/tax/vat";

export type OrderItemTaxLine = {
  total: number;
  tax_rate: number;
};

export type RecalculatedOrderTotals = {
  subtotal: number;
  tax_amount: number;
  tax_percent: number;
  total: number;
};

/** Recompute order totals from persisted line snapshots (gross-inclusive). */
export function recalculateOrderTotalsFromItems(
  items: OrderItemTaxLine[],
  discountAmount = 0
): RecalculatedOrderTotals {
  const taxResult = calculateOrderTaxFromItems(
    items.map((item) => ({
      lineTotal: Number(item.total),
      taxRate: Number(item.tax_rate),
    }))
  );

  const total = applyOrderDiscount(taxResult.total, discountAmount);

  return {
    subtotal: taxResult.subtotal,
    tax_amount: taxResult.taxAmount,
    tax_percent: taxResult.effectiveTaxPercent,
    total,
  };
}
