import {
  resolveVoidPhase,
  type VoidPhase,
} from "@/lib/loss-prevention/resolve-void-phase";

export type VoidLadderInput = {
  orderStatus: string;
  paymentStatus: string;
  reason?: string | null;
  actorRole: string;
  approvedByStaffId?: string | null;
  stationStates?: Array<{ station: string; status: string }>;
};

export type VoidLadderAllowed = {
  allowed: true;
  phase: VoidPhase;
  requiresReason: boolean;
  requiresManager: boolean;
  approvedByStaffId: string | null;
};

export type VoidLadderBlocked = {
  allowed: false;
  phase: VoidPhase;
  error: string;
  status: number;
};

export type VoidLadderResult = VoidLadderAllowed | VoidLadderBlocked;

const MANAGER_ROLES = new Set(["owner", "manager"]);

function isManagerRole(role: string): boolean {
  return MANAGER_ROLES.has(role);
}

function hasReason(reason?: string | null): boolean {
  return Boolean(reason?.trim());
}

/** ADR-044 S2 — server-side void ladder (queued → reason → manager → block). */
export function evaluateVoidLadder(input: VoidLadderInput): VoidLadderResult {
  const phase = resolveVoidPhase(
    input.orderStatus,
    input.paymentStatus,
    input.stationStates
  );

  if (phase === "paid") {
    return {
      allowed: false,
      phase,
      error:
        "Order is paid — use the fiscal storno or refund flow instead of void.",
      status: 409,
    };
  }

  if (phase === "served") {
    const managerApproved =
      isManagerRole(input.actorRole) || Boolean(input.approvedByStaffId);
    if (!managerApproved) {
      return {
        allowed: false,
        phase,
        error: "Manager approval is required to void after serving.",
        status: 403,
      };
    }
    if (!hasReason(input.reason)) {
      return {
        allowed: false,
        phase,
        error: "Reason is required to void after serving.",
        status: 400,
      };
    }
    return {
      allowed: true,
      phase,
      requiresReason: true,
      requiresManager: true,
      approvedByStaffId:
        input.approvedByStaffId ??
        (isManagerRole(input.actorRole) ? null : null),
    };
  }

  if (phase === "in_prep") {
    if (!hasReason(input.reason)) {
      return {
        allowed: false,
        phase,
        error: "Reason is required to void while preparation is in progress.",
        status: 400,
      };
    }
    return {
      allowed: true,
      phase,
      requiresReason: true,
      requiresManager: false,
      approvedByStaffId: null,
    };
  }

  return {
    allowed: true,
    phase,
    requiresReason: false,
    requiresManager: false,
    approvedByStaffId: null,
  };
}
