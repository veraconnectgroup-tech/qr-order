import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import {
  emptyCartState,
  type DenisCartDraft,
  type DenisCartState,
} from "@/lib/denis/kernel/cart-projection";

export function aiOrderDraftToDenisCartState(
  draft: AiOrderDraft | null | undefined
): DenisCartState {
  const normalized = draft ?? initDraftFromStorage(null);
  const items = normalized.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    serveSize: item.serveSize,
    modifierIds: [...item.modifierIds],
    notes: item.notes,
    lineTotal: item.lineTotal,
    menuSection: item.menuSection,
    productTaxRate: item.productTaxRate,
  }));

  return {
    draft: {
      items,
      cartRevision: normalized.cartRevision,
    },
    undoStack: [],
  };
}

export type ManualCartSnapshot = {
  revision: number;
  updatedAt: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    serveSize: string | null;
    lineTotal: number;
    modifierIds?: string[];
    menuSection?: string | null;
  }>;
};

export function manualSnapshotToDenisDraft(
  snapshot: ManualCartSnapshot | null | undefined
): DenisCartDraft | undefined {
  if (!snapshot?.items.length) return undefined;
  return {
    cartRevision: snapshot.revision,
    items: snapshot.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      serveSize: item.serveSize,
      modifierIds: item.modifierIds ?? [],
      notes: "",
      lineTotal: item.lineTotal,
      menuSection: item.menuSection ?? null,
      productTaxRate: null,
    })),
  };
}
