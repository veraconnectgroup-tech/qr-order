import type { SensitiveAction } from "@/lib/audit/sensitive-action-types";
import type { VoidPhase } from "@/lib/loss-prevention/resolve-void-phase";

const FORBIDDEN_PHRASES = [
  "krade",
  "krao",
  "krala",
  "stealing",
  "thief",
  "malverzacija",
  "prevara",
  "fraud",
  "krivac",
  "guilty",
];

export type FlagCopyInput = {
  action: SensitiveAction;
  tableName?: string | null;
  orderNumber?: number | null;
  amount?: number | null;
  voidPhase?: VoidPhase | null;
  reasonMissing?: boolean;
};

function formatAmount(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "";
  return `${amount.toFixed(2)}€`;
}

/** ADR-044 §2 — neutral "treba proveru" copy, never accusation. */
export function buildSuspiciousFlagCopy(input: FlagCopyInput): string {
  const table = input.tableName ? `sto ${input.tableName}` : "sto";
  const order =
    input.orderNumber != null ? `račun #${input.orderNumber}` : "račun";
  const amount = formatAmount(input.amount);

  switch (input.action) {
    case "void":
      if (input.voidPhase === "served" && input.reasonMissing) {
        return `Void posle serviranja bez razloga na ${table} — treba proveru.`;
      }
      return `Void na ${table} (${order}) — treba proveru.`;
    case "transfer":
      return `Transfer ${order} sa ${table} posle naplate — treba proveru.`;
    case "split":
      return `Split ${order} posle delimične naplate — treba proveru.`;
    case "merge":
      return `Merge sesije na ${table} posle naplate — treba proveru.`;
    case "payment_mismatch":
      return `Neslaganje plaćanja na ${table}${amount ? ` (${amount})` : ""} — treba proveru.`;
    case "refund":
      return `Refund ${order}${amount ? ` (${amount})` : ""} — treba proveru.`;
    case "discount":
      return `Popust van proseka na ${table} — treba proveru.`;
    case "session_close":
      return `Zatvaranje sesije na ${table} sa otvorenim balansom — treba proveru.`;
    default:
      return `Nelogična akcija na ${table} — treba proveru.`;
  }
}

export function containsAccusatoryPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_PHRASES.some((phrase) => lower.includes(phrase));
}
