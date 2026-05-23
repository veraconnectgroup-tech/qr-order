export const MIN_SPLIT_PARTS = 2;
export const MAX_SPLIT_PARTS = 12;

export type SplitPaymentRow = {
  id: string;
  order_id: string;
  amount: number;
  tip_amount: number;
  stripe_payment_intent_id: string | null;
  payment_status: string;
  paid_by_session_id: string | null;
  items: string[] | null;
  created_at: string;
};

export function splitAmountEqually(total: number, parts: number): number[] {
  if (parts < 1) return [];
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  const amounts: number[] = [];
  for (let i = 0; i < parts; i++) {
    amounts.push((base + (i < remainder ? 1 : 0)) / 100);
  }
  return amounts;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumSplitAmounts(
  splits: Array<{ amount: number; tip_amount?: number }>
): { amount: number; tip: number; charge: number } {
  const amount = roundMoney(
    splits.reduce((sum, s) => sum + Number(s.amount), 0)
  );
  const tip = roundMoney(
    splits.reduce((sum, s) => sum + Number(s.tip_amount ?? 0), 0)
  );
  return { amount, tip, charge: roundMoney(amount + tip) };
}

export function collectAssignedItemIds(
  splits: Array<{ items: string[] | null }>
): Set<string> {
  const assigned = new Set<string>();
  for (const split of splits) {
    for (const id of split.items ?? []) {
      assigned.add(id);
    }
  }
  return assigned;
}

export function proportionalTip(
  partAmount: number,
  orderTotal: number,
  orderTip: number
): number {
  if (orderTip <= 0 || orderTotal <= 0) return 0;
  return roundMoney((partAmount / orderTotal) * orderTip);
}
