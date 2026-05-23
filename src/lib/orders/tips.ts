/** Max tip = 50% of food/drink total (MwSt-free, separate from order total). */
export function clampTipAmount(tipAmount: number, orderTotal: number): number {
  if (tipAmount <= 0) return 0;
  const max = Math.round(orderTotal * 0.5 * 100) / 100;
  return Math.min(Math.round(tipAmount * 100) / 100, max);
}

export function sumTips(
  orders: Array<{ tip_amount?: number | string | null }>
): number {
  return orders.reduce((sum, o) => sum + Number(o.tip_amount ?? 0), 0);
}
