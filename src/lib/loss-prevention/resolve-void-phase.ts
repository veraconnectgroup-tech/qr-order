/** ADR-044 S2 — void phase from station truth with order-status fallback. */

export type VoidPhase = "queued" | "in_prep" | "served" | "paid";

export type StationStateRow = {
  station: string;
  status: string;
};

const SERVED_STATION_STATUSES = new Set(["ready", "picked_up", "served"]);
const PREP_STATION_STATUSES = new Set(["preparing", "in_prep", "queued"]);

export function resolveVoidPhaseFromOrderStatus(
  orderStatus: string,
  paymentStatus: string
): VoidPhase {
  if (paymentStatus === "paid" || paymentStatus === "partial_refund") {
    return "paid";
  }
  if (orderStatus === "delivered" || orderStatus === "ready") {
    return "served";
  }
  if (orderStatus === "preparing") {
    return "in_prep";
  }
  return "queued";
}

export function resolveVoidPhase(
  orderStatus: string,
  paymentStatus: string,
  stationStates: StationStateRow[] = []
): VoidPhase {
  if (paymentStatus === "paid" || paymentStatus === "partial_refund") {
    return "paid";
  }

  if (stationStates.length > 0) {
    const statuses = stationStates.map((row) => row.status);
    if (statuses.some((status) => SERVED_STATION_STATUSES.has(status))) {
      return "served";
    }
    if (statuses.some((status) => PREP_STATION_STATUSES.has(status))) {
      return "in_prep";
    }
    return "queued";
  }

  return resolveVoidPhaseFromOrderStatus(orderStatus, paymentStatus);
}
