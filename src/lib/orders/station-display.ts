import {
  kdsActionLabel,
  type KitchenAdvanceAction,
  type BarAdvanceAction,
} from "@/lib/orders/patch-order-status";
import type { OrderStationState } from "@/lib/orders/fetch-order-station-states";
import {
  stationsForOrderItems,
  STATION_VALID_TRANSITIONS,
  type StationKind,
  type StationStatus,
} from "@/lib/orders/station-states";

export type KitchenKdsColumnId = "pending" | "accepted" | "preparing" | "ready";

export function isManagerRole(role: string): boolean {
  return role === "owner" || role === "manager";
}

export function getStationState(
  states: OrderStationState[] | undefined,
  station: StationKind
): OrderStationState | undefined {
  return states?.find((row) => row.station === station);
}

export function hasStationStates(states: OrderStationState[] | undefined): boolean {
  return (states?.length ?? 0) > 0;
}

/** KDS column from kitchen station row, falling back to global orders.status. */
export function kitchenKdsColumnForOrder(
  globalStatus: string,
  kitchenState: OrderStationState | undefined
): KitchenKdsColumnId | null {
  if (globalStatus === "pending" || globalStatus === "pending_approval") {
    return "pending";
  }
  if (globalStatus === "rejected" || globalStatus === "cancelled") {
    return null;
  }

  if (!kitchenState) {
    switch (globalStatus) {
      case "accepted":
        return "accepted";
      case "preparing":
        return "preparing";
      case "ready":
      case "delivered":
        return "ready";
      default:
        return null;
    }
  }

  switch (kitchenState.status) {
    case "queued":
      return "accepted";
    case "in_prep":
      return "preparing";
    case "ready":
    case "picked_up":
    case "served":
      return "ready";
    default:
      return null;
  }
}

export function nextKitchenAdvanceAction(
  globalStatus: string,
  kitchenState: OrderStationState | undefined
): KitchenAdvanceAction | null {
  if (globalStatus === "pending" || globalStatus === "pending_approval") {
    return { kind: "global", status: "accepted" };
  }

  if (!kitchenState) {
    switch (globalStatus) {
      case "accepted":
        return { kind: "global", status: "preparing" };
      case "preparing":
        return { kind: "global", status: "ready" };
      default:
        return null;
    }
  }

  switch (kitchenState.status) {
    case "queued":
      if (["accepted", "preparing", "ready"].includes(globalStatus)) {
        return { kind: "station", station: "kitchen", status: "in_prep" };
      }
      return null;
    case "in_prep":
      return { kind: "station", station: "kitchen", status: "ready" };
    default:
      return null;
  }
}

export function kitchenAdvanceActionLabel(action: KitchenAdvanceAction): string {
  if (action.kind === "global") {
    return kdsActionLabel(action.status) ?? "Advance";
  }
  if (action.status === "in_prep") return "Start preparing";
  if (action.status === "ready") return "Ready";
  return "Advance";
}

export function nextBarAdvanceAction(
  globalStatus: string,
  barState: OrderStationState | undefined
): BarAdvanceAction | null {
  if (globalStatus === "pending" || globalStatus === "pending_approval") {
    return { kind: "global", status: "accepted" };
  }

  if (!barState) {
    switch (globalStatus) {
      case "accepted":
        return { kind: "global", status: "preparing" };
      case "preparing":
        return { kind: "global", status: "ready" };
      default:
        return null;
    }
  }

  switch (barState.status) {
    case "queued":
      if (["accepted", "preparing", "ready"].includes(globalStatus)) {
        return { kind: "station", station: "bar", status: "in_prep" };
      }
      return null;
    case "in_prep":
      return { kind: "station", station: "bar", status: "ready" };
    default:
      return null;
  }
}

export function barAdvanceActionLabel(action: BarAdvanceAction): string {
  if (action.kind === "global") {
    return kdsActionLabel(action.status) ?? "Advance";
  }
  if (action.status === "in_prep") return "Start preparing";
  if (action.status === "ready") return "Ready";
  return "Advance";
}

/** Badge / column status for bar UI — station-first with global fallback. */
export function barDisplayGlobalStatus(
  globalStatus: string,
  barState: OrderStationState | undefined
): string {
  if (!barState) return globalStatus;

  switch (barState.status) {
    case "queued":
      return globalStatus === "pending" || globalStatus === "pending_approval"
        ? globalStatus
        : "accepted";
    case "in_prep":
      return "preparing";
    case "ready":
    case "picked_up":
      return "ready";
    case "served":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return globalStatus;
  }
}

export function isBarWorkComplete(
  globalStatus: string,
  barState: OrderStationState | undefined
): boolean {
  if (barState) {
    return ["picked_up", "served", "cancelled"].includes(barState.status);
  }
  return globalStatus === "delivered";
}

export type WaiterStationAction = {
  station: StationKind;
  toStatus: "picked_up" | "served";
  labelKey: "action.pickedUp" | "action.served";
};

export function waiterStationActions(
  orderItems: Array<{ menu_section?: string | null }>,
  states: OrderStationState[] | undefined
): WaiterStationAction[] {
  const stations = stationsForOrderItems(
    orderItems.map((item) => ({ menu_section: item.menu_section }))
  );
  const actions: WaiterStationAction[] = [];

  for (const station of stations) {
    const state = getStationState(states, station);
    if (!state) continue;
    if (state.status === "ready") {
      actions.push({
        station,
        toStatus: "picked_up",
        labelKey: "action.pickedUp",
      });
    } else if (state.status === "picked_up") {
      actions.push({
        station,
        toStatus: "served",
        labelKey: "action.served",
      });
    }
  }

  return actions;
}

/** Legacy orders without station rows — waiter may still mark global delivered. */
export function waiterNeedsLegacyDeliver(globalStatus: string, states: OrderStationState[] | undefined): boolean {
  return !hasStationStates(states) && globalStatus === "ready";
}

export function managerStationOverrideTransitions(
  current: StationStatus | undefined
): StationStatus[] {
  if (!current) return [];
  return STATION_VALID_TRANSITIONS[current] ?? [];
}
