/** MwSt-free tip; max €500 per order (DE Trinkgeld). */
export const MAX_TIP_AMOUNT = 500;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampTipAmount(tipAmount: number, orderTotal: number): number {
  if (tipAmount <= 0) return 0;
  const maxByPercent = Math.round(orderTotal * 0.5 * 100) / 100;
  const capped = Math.min(tipAmount, MAX_TIP_AMOUNT, maxByPercent);
  return roundMoney(capped);
}

export function sumTips(
  orders: Array<{ tip_amount?: number | string | null }>
): number {
  return orders.reduce((sum, o) => sum + Number(o.tip_amount ?? 0), 0);
}

/** Split session tip across unpaid orders by share of total. */
export function distributeTipAcrossOrders(
  orders: Array<{ id: string; total: number }>,
  tipAmount: number
): Array<{ id: string; tip_amount: number }> {
  if (orders.length === 0) return [];
  if (tipAmount <= 0) {
    return orders.map((o) => ({ id: o.id, tip_amount: 0 }));
  }
  if (orders.length === 1) {
    return [{ id: orders[0].id, tip_amount: tipAmount }];
  }

  const sessionTotal = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const parts = orders.map((o) => ({
    id: o.id,
    tip_amount: roundMoney((Number(o.total) / sessionTotal) * tipAmount),
  }));

  const allocated = parts.reduce((sum, p) => sum + p.tip_amount, 0);
  const remainder = roundMoney(tipAmount - allocated);
  if (remainder !== 0) {
    parts[0].tip_amount = roundMoney(parts[0].tip_amount + remainder);
  }

  return parts;
}
