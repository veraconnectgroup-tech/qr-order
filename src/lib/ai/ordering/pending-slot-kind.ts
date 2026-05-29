import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";

export type OrderPendingSlotKind = "serve_size" | "modifier" | "product";

/** Map legacy order_draft.pending → slot kind for Denis beliefs / ACT. */
export function pendingSlotKindFromDraft(
  draft: AiOrderDraft | null | undefined
): OrderPendingSlotKind | null {
  if (!draft?.pending) return null;

  for (const missing of draft.pending.missing) {
    if (missing.kind === "serveSize") return "serve_size";
    if (missing.kind === "modifierGroup") return "modifier";
  }

  return "product";
}
