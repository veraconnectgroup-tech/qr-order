/** ADR-044 S3 — split/merge/transfer total invariance. */

export type TotalPreservedMismatch = {
  ok: false;
  status: 409;
  error: string;
  beforeTotal: number;
  afterTotal: number;
  delta: number;
};

export type TotalPreservedOk = { ok: true };

export type TotalPreservedResult = TotalPreservedOk | TotalPreservedMismatch;

const MONEY_EPSILON = 0.005;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMoneyEur(amount: number): string {
  return `${roundMoney(amount).toFixed(2)}€`;
}

/** Block when totals diverge — ADR-044 §4.3. */
export function assertTotalPreserved(
  beforeTotal: number,
  afterTotal: number,
  label = "Operation"
): TotalPreservedResult {
  const before = roundMoney(beforeTotal);
  const after = roundMoney(afterTotal);
  const delta = roundMoney(after - before);

  if (Math.abs(delta) <= MONEY_EPSILON) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 409,
    error: `${label} mismatch: pre ${formatMoneyEur(before)}, posle ${formatMoneyEur(after)}. Razlika ${formatMoneyEur(Math.abs(delta))}.`,
    beforeTotal: before,
    afterTotal: after,
    delta,
  };
}
