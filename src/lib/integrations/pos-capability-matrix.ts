/**
 * POS Capability Matrix — coded directly from the Denis AI × Deliverect ×
 * Stripe feasibility report (2026-07-12 research pass). This is the single
 * source of truth for "what can Denis actually promise a guest," feeding
 * both his own prompt (loadCapabilityAwarenessBlock) and any future ACL
 * logic that decides whether to offer e.g. "pay at the end" vs "pay now."
 *
 * Every entry keeps its research confidence label on purpose — most rows
 * are NOT_CONFIRMED, not because nobody checked, but because Deliverect's
 * own documentation doesn't cover it for these POS systems. Update a row
 * only once Deliverect or the POS vendor confirms it directly (see
 * docs/partnerships/deliverect-partnership-questions.md) — never flip a
 * label based on inference alone.
 */

export type PosVendor = "toast" | "lightspeed" | "orderbird" | "unknown";

export type CapabilityConfidence =
  | "confirmed"
  | "pos_dependent"
  | "not_confirmed"
  | "not_supported";

export type PosCapabilityKey =
  | "dineInOrder"
  | "prepaidFlag"
  | "tableIdRealRouting"
  | "readOpenBill"
  | "appendToOpenBill"
  | "externalTenderOnOpenBill"
  | "closeBill"
  | "splitBill"
  | "customPaymentMethodLabel"
  | "tips"
  | "floorPlanApi";

export type PosCapabilityEntry = {
  status: CapabilityConfidence;
  /** Short, human note — why this status, what the honest fallback is. */
  note: string;
};

export type PosCapabilities = Record<PosCapabilityKey, PosCapabilityEntry>;

const BASELINE: PosCapabilities = {
  dineInOrder: {
    status: "confirmed",
    note: "Deliverect's Order API supports eat-in orders (orderType 3) — works regardless of POS adapter.",
  },
  prepaidFlag: {
    status: "confirmed",
    note: "orderIsAlreadyPaid flag is a real, documented Deliverect API field.",
  },
  tableIdRealRouting: {
    status: "pos_dependent",
    note: "Deliverect's own docs: \"not all POS systems currently return the table IDs\" — may fall back to a text note instead of real routing.",
  },
  readOpenBill: {
    status: "not_supported",
    note: "No endpoint exists in Deliverect's API to read an in-progress bill — only a one-way, POS-to-Deliverect push of already-closed bills.",
  },
  appendToOpenBill: {
    status: "not_supported",
    note: "Every Deliverect order needs its own unique channelOrderId — no documented way to add items to an existing order.",
  },
  externalTenderOnOpenBill: {
    status: "not_confirmed",
    note: "External-tender configs exist for PAR Brink/Aldelo, but only for orders Deliverect itself creates — not for marking a waiter-opened tab as paid.",
  },
  closeBill: {
    status: "not_confirmed",
    note: "No close-bill endpoint found anywhere in Deliverect's documentation.",
  },
  splitBill: {
    status: "not_confirmed",
    note: "No split-bill/partial-payment documentation exists for the Deliverect API.",
  },
  customPaymentMethodLabel: {
    status: "not_confirmed",
    note: "A custom \"external payment tender\" label is documented for PAR Brink and Aldelo only.",
  },
  tips: {
    status: "pos_dependent",
    note: "Deliverect's tip/driverTip fields exist, but its own docs warn \"not all POS partners will handle this addition to an order.\"",
  },
  floorPlanApi: {
    status: "pos_dependent",
    note: "Table list + seat count are real; coordinates, shape, and occupied/free status are not exposed by Deliverect at all — build a separate Denis Floor Model.",
  },
};

/**
 * Per-vendor overrides, layered onto BASELINE. Only Toast/Lightspeed/
 * orderbird have been researched (2026-07-12) — everything else stays on
 * the conservative baseline. See the feasibility report's §06 matrix for
 * the exact per-question findings these entries summarize.
 */
const VENDOR_OVERRIDES: Record<
  Exclude<PosVendor, "unknown">,
  Partial<PosCapabilities>
> = {
  toast: {
    dineInOrder: {
      status: "not_confirmed",
      note: "Deliverect's Toast setup docs mention only Takeout/Pickup/Delivery — no dine-in language found for this specific adapter.",
    },
    appendToOpenBill: {
      status: "not_supported",
      note: "Toast's own native API CAN append items to an existing check — but no evidence Deliverect's Toast adapter uses that endpoint.",
    },
  },
  lightspeed: {
    dineInOrder: {
      status: "not_confirmed",
      note: "Deliverect's Lightspeed K-Series/L-Series docs describe delivery/takeout flow only.",
    },
  },
  orderbird: {
    dineInOrder: {
      status: "not_confirmed",
      note: "orderbird has no dedicated Deliverect integration-overview article at all — the thinnest documentation of the three researched POS systems.",
    },
    floorPlanApi: {
      status: "not_confirmed",
      note: "orderbird has a native \"Tischplan\" floor-plan UI, but no public API for it and no Deliverect coverage found.",
    },
  },
};

export function resolvePosCapabilities(vendor: PosVendor): PosCapabilities {
  if (vendor === "unknown") return BASELINE;
  const overrides = VENDOR_OVERRIDES[vendor];
  return { ...BASELINE, ...overrides } as PosCapabilities;
}
