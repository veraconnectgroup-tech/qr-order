import type { DenisCartDraft, DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import { cloneLine, lineFingerprint } from "@/lib/denis/kernel/conflict/line-match";
import type { MergedCart } from "@/lib/denis/loop/types";

function unionVisibleLines(
  aiLines: DenisCartLine[],
  manual?: DenisCartDraft,
  peerManual?: DenisCartDraft
): DenisCartLine[] {
  const merged = new Map<string, DenisCartLine>();

  for (const source of [manual?.items ?? [], peerManual?.items ?? [], aiLines]) {
    for (const line of source) {
      const fp = lineFingerprint(line);
      if (!merged.has(fp)) {
        merged.set(fp, cloneLine(line));
      }
    }
  }

  return [...merged.values()];
}

export function buildMergedCart(input: {
  ai: MergedCart["ai"];
  manual?: DenisCartDraft;
  peerManual?: DenisCartDraft;
}): MergedCart {
  return {
    ai: input.ai,
    manual: input.manual,
    peerManual: input.peerManual,
    visibleLines: unionVisibleLines(
      input.ai.draft.items,
      input.manual,
      input.peerManual
    ),
  };
}
