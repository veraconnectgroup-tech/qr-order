/** Denis cart projection — kernel-native (M4). Adapter to legacy draft at runtime/M7. */
export type DenisCartLine = {
  productId: string;
  productName: string;
  quantity: number;
  serveSize: string | null;
  modifierIds: string[];
  notes: string;
  lineTotal: number;
  menuSection?: string | null;
  productTaxRate?: number | null;
};

export type DenisCartDraft = {
  items: DenisCartLine[];
  cartRevision: number;
};

export type CartLineDiff =
  | { kind: "remove"; index: number; line: DenisCartLine }
  | { kind: "quantity"; index: number; from: number; to: number }
  | { kind: "replace"; index: number; from: DenisCartLine; to: DenisCartLine }
  | { kind: "undo"; restoredRevision: number };

export type CartUndoEntry = {
  revision: number;
  diff: CartLineDiff;
  at: string;
};

export type DenisCartState = {
  draft: DenisCartDraft;
  undoStack: CartUndoEntry[];
};

export const MAX_CART_UNDO_DEPTH = 5;

export function emptyCartDraft(): DenisCartDraft {
  return { items: [], cartRevision: 0 };
}

export function emptyCartState(): DenisCartState {
  return { draft: emptyCartDraft(), undoStack: [] };
}

export function cloneCartDraft(draft: DenisCartDraft): DenisCartDraft {
  return {
    cartRevision: draft.cartRevision,
    items: draft.items.map((line) => ({ ...line, modifierIds: [...line.modifierIds] })),
  };
}

export function bumpCartRevision(draft: DenisCartDraft): DenisCartDraft {
  return {
    ...draft,
    cartRevision: draft.cartRevision + 1,
  };
}

export function cartLinesForSignals(
  draft: DenisCartDraft
): Array<{ menuSection?: string | null }> {
  return draft.items.map((item) => ({ menuSection: item.menuSection }));
}
