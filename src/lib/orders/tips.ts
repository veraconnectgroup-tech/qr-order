/** MwSt-free tip; max €500 per order (DE Trinkgeld). */
export const MAX_TIP_AMOUNT = 500;

export function clampTipAmount(tipAmount: number, orderTotal: number): number {
  if (tipAmount <= 0) return 0;
  const maxByPercent = Math.round(orderTotal * 0.5 * 100) / 100;
  const capped = Math.min(tipAmount, MAX_TIP_AMOUNT, maxByPercent);
  return Math.round(capped * 100) / 100;
}

export function sumTips(
  orders: Array<{ tip_amount?: number | string | null }>
): number {
  return orders.reduce((sum, o) => sum + Number(o.tip_amount ?? 0), 0);
}
