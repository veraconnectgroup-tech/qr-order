import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { CartConflict } from "@/lib/denis/kernel/conflict/types";
import {
  lineFingerprint,
  unitPrice,
} from "@/lib/denis/kernel/conflict/line-match";

function indexByFingerprint(
  items: DenisCartDraft["items"]
): Map<string, DenisCartDraft["items"][number]> {
  const map = new Map<string, DenisCartDraft["items"][number]>();
  for (const line of items) {
    map.set(lineFingerprint(line), line);
  }
  return map;
}

/** Compare AI draft vs manual cart — deterministic (ADR-004 §6). */
export function detectCartConflicts(
  ai: DenisCartDraft,
  manual: DenisCartDraft
): CartConflict[] {
  if (manual.items.length === 0) {
    return [];
  }

  const conflicts: CartConflict[] = [];
  const aiByFp = indexByFingerprint(ai.items);
  const manualByFp = indexByFingerprint(manual.items);
  const seenDrift = new Set<string>();

  for (const [fp, aiLine] of aiByFp) {
    const manualLine = manualByFp.get(fp);
    if (!manualLine) {
      conflicts.push({ kind: "ai_only", line: aiLine });
      continue;
    }

    if (aiLine.quantity !== manualLine.quantity) {
      conflicts.push({ kind: "duplicate_line", ai: aiLine, manual: manualLine });
    }

    const aiUnit = unitPrice(aiLine);
    const manualUnit = unitPrice(manualLine);
    if (aiUnit !== manualUnit && !seenDrift.has(fp)) {
      seenDrift.add(fp);
      conflicts.push({
        kind: "price_drift",
        productId: aiLine.productId,
        productName: aiLine.productName,
        expected: manualUnit,
        actual: aiUnit,
      });
    }
  }

  for (const [fp, manualLine] of manualByFp) {
    if (!aiByFp.has(fp)) {
      conflicts.push({ kind: "manual_only", line: manualLine });
    }
  }

  return conflicts;
}

export function hasCartConflicts(
  ai: DenisCartDraft,
  manual: DenisCartDraft
): boolean {
  if (manual.items.length === 0) return false;
  return detectCartConflicts(ai, manual).length > 0;
}
