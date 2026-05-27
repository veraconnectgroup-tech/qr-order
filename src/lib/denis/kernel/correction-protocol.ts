import {
  bumpCartRevision,
  cloneCartDraft,
  MAX_CART_UNDO_DEPTH,
  type CartLineDiff,
  type CartUndoEntry,
  type DenisCartDraft,
  type DenisCartLine,
  type DenisCartState,
} from "@/lib/denis/kernel/cart-projection";
import type { CorrectionCommand } from "@/lib/denis/kernel/reflex-rules";

export type CorrectionOutcome =
  | {
      ok: true;
      state: DenisCartState;
      diff: CartLineDiff;
      guestMessage: string;
      skillId: "cart.remove" | "cart.replace" | "cart.add_or_clarify";
    }
  | { ok: false; reason: string; guestMessage: string };

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function lineMatchesQuery(lineName: string, query: string): boolean {
  const line = normalizeName(lineName);
  const needle = normalizeName(query);
  if (!needle) return false;
  if (line.includes(needle) || needle.includes(line)) return true;
  const firstWord = line.split(/\s+/)[0] ?? "";
  const prefix = needle.slice(0, Math.min(3, needle.length));
  return (
    prefix.length >= 2 &&
    (firstWord.startsWith(prefix) || needle.startsWith(firstWord.slice(0, 3)))
  );
}

function findLineIndexByName(draft: DenisCartDraft, name: string): number {
  return draft.items.findIndex((line) =>
    lineMatchesQuery(line.productName, name)
  );
}

function lastLineIndex(draft: DenisCartDraft): number {
  return draft.items.length > 0 ? draft.items.length - 1 : -1;
}

function unitPrice(line: DenisCartLine): number {
  return line.quantity > 0 ? line.lineTotal / line.quantity : line.lineTotal;
}

function pushUndo(
  state: DenisCartState,
  diff: CartLineDiff,
  at: string
): CartUndoEntry[] {
  const entry: CartUndoEntry = {
    revision: state.draft.cartRevision,
    diff,
    at,
  };
  const next = [...state.undoStack, entry];
  return next.slice(-MAX_CART_UNDO_DEPTH);
}

function applyMutation(
  state: DenisCartState,
  diff: CartLineDiff,
  nextDraft: DenisCartDraft,
  at: string
): DenisCartState {
  return {
    draft: bumpCartRevision(nextDraft),
    undoStack: pushUndo(state, diff, at),
  };
}

export function undoLastCartChange(state: DenisCartState): CorrectionOutcome {
  const entry = state.undoStack[state.undoStack.length - 1];
  if (!entry) {
    return {
      ok: false,
      reason: "empty_undo_stack",
      guestMessage: "Nema prethodne izmene za poništavanje.",
    };
  }

  const restored = cloneCartDraft(state.draft);
  const diff = entry.diff;

  switch (diff.kind) {
    case "remove": {
      restored.items.splice(diff.index, 0, diff.line);
      break;
    }
    case "quantity": {
      const line = restored.items[diff.index];
      if (line) {
        line.quantity = diff.from;
        line.lineTotal = unitPrice(line) * diff.from;
      }
      break;
    }
    case "replace": {
      restored.items[diff.index] = { ...diff.from, modifierIds: [...diff.from.modifierIds] };
      break;
    }
    case "undo":
      break;
  }

  return {
    ok: true,
    state: {
      draft: bumpCartRevision(restored),
      undoStack: state.undoStack.slice(0, -1),
    },
    diff: { kind: "undo", restoredRevision: entry.revision },
    guestMessage: "Vraćeno na prethodnu korpu.",
    skillId: "cart.remove",
  };
}

export function applyCorrectionCommand(
  state: DenisCartState,
  command: CorrectionCommand,
  options?: { maxQuantityPerLine?: number; at?: string }
): CorrectionOutcome {
  const at = options?.at ?? new Date().toISOString();
  const maxQty = options?.maxQuantityPerLine ?? 20;

  if (command.kind === "UNDO") {
    return undoLastCartChange(state);
  }

  const draft = cloneCartDraft(state.draft);

  if (command.kind === "ADD_MORE") {
    const idx =
      command.targetName !== null
        ? findLineIndexByName(draft, command.targetName)
        : lastLineIndex(draft);
    if (idx < 0) {
      return {
        ok: false,
        reason: "no_line",
        guestMessage: "Nema stavke za dodavanje.",
      };
    }
    const line = draft.items[idx];
    if (line.quantity >= maxQty) {
      return {
        ok: false,
        reason: "max_quantity",
        guestMessage: `Maksimum ${maxQty} po stavci.`,
      };
    }
    const from = line.quantity;
    line.quantity += 1;
    line.lineTotal = unitPrice(line) * line.quantity;
    const nextState = applyMutation(
      state,
      { kind: "quantity", index: idx, from, to: line.quantity },
      draft,
      at
    );
    return {
      ok: true,
      state: nextState,
      diff: { kind: "quantity", index: idx, from, to: line.quantity },
      guestMessage: `Dodato: ${line.productName} (${line.quantity}×).`,
      skillId: "cart.add_or_clarify",
    };
  }

  if (command.kind === "REMOVE") {
    const idx = findLineIndexByName(draft, command.targetName);
    if (idx < 0) {
      return {
        ok: false,
        reason: "line_not_found",
        guestMessage: `Nisam našao „${command.targetName}" u korpi.`,
      };
    }
    const [removed] = draft.items.splice(idx, 1);
    const nextState = applyMutation(
      state,
      { kind: "remove", index: idx, line: removed },
      draft,
      at
    );
    return {
      ok: true,
      state: nextState,
      diff: { kind: "remove", index: idx, line: removed },
      guestMessage: `Uklonjeno: ${removed.productName}.`,
      skillId: "cart.remove",
    };
  }

  if (command.kind === "CORRECT") {
    const idx = lastLineIndex(draft);
    if (idx < 0) {
      return {
        ok: false,
        reason: "empty_cart",
        guestMessage: "Korpa je prazna.",
      };
    }
    if (!command.targetName) {
      const [removed] = draft.items.splice(idx, 1);
      const nextState = applyMutation(
        state,
        { kind: "remove", index: idx, line: removed },
        draft,
        at
      );
      return {
        ok: true,
        state: nextState,
        diff: { kind: "remove", index: idx, line: removed },
        guestMessage: `Uklonjeno: ${removed.productName}.`,
        skillId: "cart.remove",
      };
    }
    return {
      ok: false,
      reason: "replace_needs_catalog",
      guestMessage: `Razumem „${command.targetName}" — dodajem u sledećem koraku (M7 katalog).`,
    };
  }

  if (command.kind === "REPLACE") {
    const idx = lastLineIndex(draft);
    if (idx < 0) {
      return {
        ok: false,
        reason: "empty_cart",
        guestMessage: "Korpa je prazna.",
      };
    }
    return {
      ok: false,
      reason: "replace_needs_catalog",
      guestMessage: `Promena u „${command.targetName}" — katalog u M7.`,
    };
  }

  return {
    ok: false,
    reason: "unknown_command",
    guestMessage: "Nisam razumeo izmenu.",
  };
}
