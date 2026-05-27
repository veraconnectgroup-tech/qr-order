import {
  emptyCartDraft,
  type DenisCartDraft,
  type DenisCartLine,
} from "@/lib/denis/kernel/cart-projection";
import { lineFingerprint, unitPrice } from "@/lib/denis/kernel/conflict/line-match";

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} i ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} i ${names[names.length - 1]}`;
}

/** Union local + peer manual for combined conflict check (M12). */
export function combineManualDrafts(
  local: DenisCartDraft | undefined,
  peer: DenisCartDraft
): DenisCartDraft {
  const base = local ?? emptyCartDraft();
  if (peer.items.length === 0) return base;

  const merged = new Map<string, DenisCartLine>();
  for (const line of base.items) {
    merged.set(lineFingerprint(line), { ...line });
  }
  for (const line of peer.items) {
    const fp = lineFingerprint(line);
    const existing = merged.get(fp);
    if (!existing) {
      merged.set(fp, { ...line });
      continue;
    }
    const qty = Math.max(existing.quantity, line.quantity);
    const price = unitPrice(existing);
    merged.set(fp, {
      ...existing,
      quantity: qty,
      lineTotal: Number((price * qty).toFixed(2)),
    });
  }

  return {
    cartRevision: Math.max(base.cartRevision, 0),
    items: [...merged.values()],
  };
}

/** Guest prompt when another device at the table added items (M12). */
export function buildPeerAddedPrompt(lines: DenisCartLine[]): string | null {
  if (lines.length === 0) return null;

  const names = [
    ...new Set(lines.map((line) => line.productName.trim()).filter(Boolean)),
  ];
  if (names.length === 0) return null;

  return `Tvoj drug je dodao ${joinNames(names)} — da uključim u narudžbinu?`;
}
