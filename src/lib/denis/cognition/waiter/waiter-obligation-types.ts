/** ADR-032 — structured waiter contract (understood / in-cart / gaps / next step). */

export type WaiterGapKind =
  | "drink_unspecified"
  | "substitution_note"
  | "serve_size"
  | "modifier"
  | "confirm_blocked";

export type WaiterGap = {
  kind: WaiterGapKind;
  prompt: string;
};

export type WaiterNextAction =
  | "clarify_gap"
  | "confirm_order"
  | "continue_ordering"
  | "continue_browse"
  | "await_slot";

export type WaiterObligation = {
  understood: string[];
  inCart: string[];
  gaps: WaiterGap[];
  nextAction: WaiterNextAction;
  /** False while gaps exist or cart is empty at recap. */
  canConfirm: boolean;
  primaryGap: WaiterGapKind | null;
};

export function emptyWaiterObligation(): WaiterObligation {
  return {
    understood: [],
    inCart: [],
    gaps: [],
    nextAction: "continue_browse",
    canConfirm: false,
    primaryGap: null,
  };
}
