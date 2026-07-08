const MANAGER_ROLES = new Set(["owner", "manager"]);
const BLOCKED_ORDER_STATUSES = new Set(["rejected", "cancelled"]);
const MANAGER_REQUIRED_STATUSES = new Set([
  "accepted",
  "preparing",
  "ready",
  "delivered",
]);

export type PriceOverrideInput = {
  orderStatus: string;
  paymentStatus: string;
  reason?: string | null;
  actorRole: string;
  unitPrice: number;
};

export type PriceOverrideAllowed = {
  allowed: true;
  requiresManager: boolean;
  approvedByStaffId: string | null;
};

export type PriceOverrideBlocked = {
  allowed: false;
  error: string;
  status: number;
};

export type PriceOverrideResult = PriceOverrideAllowed | PriceOverrideBlocked;

function isManagerRole(role: string): boolean {
  return MANAGER_ROLES.has(role);
}

function hasReason(reason?: string | null): boolean {
  return Boolean(reason?.trim());
}

/** ADR-044 S5 — manual unit price override guardrails. */
export function evaluatePriceOverride(
  input: PriceOverrideInput
): PriceOverrideResult {
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    return {
      allowed: false,
      error: "Unit price must be a positive number.",
      status: 400,
    };
  }

  if (BLOCKED_ORDER_STATUSES.has(input.orderStatus)) {
    return {
      allowed: false,
      error: "Cannot override price on a cancelled or rejected order.",
      status: 409,
    };
  }

  if (input.paymentStatus === "paid") {
    return {
      allowed: false,
      error: "Cannot override price after payment. Use storno/refund flow.",
      status: 409,
    };
  }

  if (
    input.paymentStatus === "refunded" ||
    input.paymentStatus === "partial_refund"
  ) {
    return {
      allowed: false,
      error: "Cannot override price on a refunded order.",
      status: 409,
    };
  }

  if (!hasReason(input.reason)) {
    return {
      allowed: false,
      error: "Reason is required for manual price override.",
      status: 400,
    };
  }

  const requiresManager = MANAGER_REQUIRED_STATUSES.has(input.orderStatus);

  if (requiresManager && !isManagerRole(input.actorRole)) {
    return {
      allowed: false,
      error: "Manager approval is required to override price after acceptance.",
      status: 403,
    };
  }

  return {
    allowed: true,
    requiresManager,
    approvedByStaffId: requiresManager ? null : null,
  };
}
