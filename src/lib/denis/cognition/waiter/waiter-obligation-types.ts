/** ADR-032 — structured waiter contract (understood / in-cart / gaps / next step). */

export type WaiterGapKind =
  | "drink_unspecified"
  | "substitution_note"
  | "allergy_warning"
  | "serve_size"
  | "modifier"
  | "confirm_blocked"
  /** ADR-043 S13 — floor ops: table paid, needs bussing (persisted in table_bus_obligations). */
  | "bus_table";

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
  /** Per-item prep ETA copy for guest communication (Kitchen Mind Link). */
  prepTimeCommunication?: string | null;
};

export function emptyWaiterObligation(): WaiterObligation {
  return {
    understood: [],
    inCart: [],
    gaps: [],
    nextAction: "continue_browse",
    canConfirm: false,
    primaryGap: null,
    prepTimeCommunication: null,
  };
}
