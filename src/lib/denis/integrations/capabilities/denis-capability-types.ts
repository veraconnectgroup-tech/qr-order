/**
 * ADR-052 §D — capability model for Integration Builder-generated
 * connectors. Wider than pos-capability-matrix.ts (that one is POS-only,
 * hand-researched for today's three vendors); this one covers any
 * capability an AI-generated adapter might claim, POS or not.
 *
 * The one non-negotiable rule this whole layer exists to enforce: a
 * capability recorded as "supported"/"supported_with_limitations" without
 * a quotedSpan is a programming error, not a valid state — see
 * capability-mapper.ts, which is the only place allowed to construct a
 * CapabilityRecord.
 */

export type DenisCapability =
  | "menu.read"
  | "product.availability.read"
  | "order.create"
  | "order.update"
  | "order.cancel"
  | "order.status.read"
  | "table.list"
  | "table.status.read"
  | "floor_plan.read"
  | "bill.read"
  | "bill.append_items"
  | "bill.apply_payment"
  | "bill.close"
  | "payment.refund"
  | "reservation.availability.read"
  | "reservation.create";

export const DENIS_CAPABILITIES = [
  "menu.read",
  "product.availability.read",
  "order.create",
  "order.update",
  "order.cancel",
  "order.status.read",
  "table.list",
  "table.status.read",
  "floor_plan.read",
  "bill.read",
  "bill.append_items",
  "bill.apply_payment",
  "bill.close",
  "payment.refund",
  "reservation.availability.read",
  "reservation.create",
] as const satisfies readonly DenisCapability[];

export type CapabilityStatus =
  | "supported"
  | "supported_with_limitations"
  | "unsupported"
  | "requires_direct_integration"
  | "requires_human_operation"
  | "unknown"
  | "experimental";

export type CapabilitySideEffectLevel =
  | "none"
  | "mutating"
  | "financial"
  | "destructive";

/** One capability proposal for one endpoint — pre-enforcement, may still lack a quotedSpan. */
export type CapabilityProposal = {
  capability: DenisCapability;
  status: CapabilityStatus;
  endpoint: string | null;
  quotedSpan: string | null;
  source: "heuristic" | "llm";
  confidence: number;
};

/** Post-enforcement — every "supported"/"supported_with_limitations" row here is guaranteed to carry a quotedSpan. */
export type CapabilityRecord = {
  capability: DenisCapability;
  status: CapabilityStatus;
  endpoint: string | null;
  sideEffectLevel: CapabilitySideEffectLevel;
  confirmationRequired: boolean;
  quotedSpan: string | null;
  knownLimitations: string[];
};

export type CapabilityManifest = {
  provider: string;
  records: CapabilityRecord[];
};

const SIDE_EFFECT_LEVEL_BY_CAPABILITY: Record<
  DenisCapability,
  CapabilitySideEffectLevel
> = {
  "menu.read": "none",
  "product.availability.read": "none",
  "order.create": "mutating",
  "order.update": "mutating",
  "order.cancel": "mutating",
  "order.status.read": "none",
  "table.list": "none",
  "table.status.read": "none",
  "floor_plan.read": "none",
  "bill.read": "none",
  "bill.append_items": "mutating",
  "bill.apply_payment": "financial",
  "bill.close": "financial",
  "payment.refund": "financial",
  "reservation.availability.read": "none",
  "reservation.create": "mutating",
};

/** Deterministic — never guessed per-capability, always looked up from this table. */
export function resolveSideEffectLevel(
  capability: DenisCapability
): CapabilitySideEffectLevel {
  return SIDE_EFFECT_LEVEL_BY_CAPABILITY[capability];
}

/** financial/destructive capabilities always require human confirmation before a live call — never a per-capability judgment call. */
export function resolveConfirmationRequired(
  level: CapabilitySideEffectLevel
): boolean {
  return level === "financial" || level === "destructive";
}

/**
 * Single source of truth for generated method names — shared by
 * adapter-generator.ts and contract-test-generator.ts so the two can
 * never drift apart and produce a test file that calls a method the
 * adapter doesn't have (or vice versa).
 */
const METHOD_NAME_BY_CAPABILITY: Record<DenisCapability, string> = {
  "menu.read": "getMenu",
  "product.availability.read": "getAvailability",
  "order.create": "createOrder",
  "order.update": "updateOrder",
  "order.cancel": "cancelOrder",
  "order.status.read": "getOrderStatus",
  "table.list": "getTables",
  "table.status.read": "getTableStatus",
  "floor_plan.read": "getFloorPlan",
  "bill.read": "getBill",
  "bill.append_items": "addItemsToBill",
  "bill.apply_payment": "applyPayment",
  "bill.close": "closeBill",
  "payment.refund": "refundPayment",
  "reservation.availability.read": "getReservationAvailability",
  "reservation.create": "createReservation",
};

export function resolveAdapterMethodName(capability: DenisCapability): string {
  return METHOD_NAME_BY_CAPABILITY[capability];
}
