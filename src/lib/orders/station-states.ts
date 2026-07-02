import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const STATION_KINDS = ["kitchen", "bar"] as const;
export type StationKind = (typeof STATION_KINDS)[number];

export const STATION_STATUSES = [
  "queued",
  "in_prep",
  "ready",
  "picked_up",
  "served",
  "cancelled",
] as const;
export type StationStatus = (typeof STATION_STATUSES)[number];

export type StationStateRow = {
  station: StationKind;
  status: StationStatus;
};

export type OrderItemSectionInput = {
  menu_section: string | null | undefined;
};

const READY_PLUS: StationStatus[] = ["ready", "picked_up", "served"];

const GLOBAL_STATUS_RANK: Record<string, number> = {
  pending_approval: 0,
  pending: 1,
  accepted: 2,
  preparing: 3,
  ready: 4,
  delivered: 5,
};

export const STATION_VALID_TRANSITIONS: Record<StationStatus, StationStatus[]> = {
  queued: ["in_prep", "cancelled"],
  in_prep: ["ready", "cancelled"],
  ready: ["picked_up", "cancelled"],
  picked_up: ["served", "cancelled"],
  served: ["cancelled"],
  cancelled: [],
};

export function stationsForOrderItems(
  items: OrderItemSectionInput[]
): Set<StationKind> {
  const stations = new Set<StationKind>();
  for (const item of items) {
    const section = item.menu_section;
    if (isKitchenMenuSection(section)) {
      stations.add("kitchen");
    } else if (section === "drinks") {
      stations.add("bar");
    }
  }
  return stations;
}

export function isValidStationTransition(
  from: StationStatus,
  to: StationStatus
): boolean {
  return STATION_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** ADR-043 §4.2 — global status never moves backward. */
export function aggregateGlobalStatus(
  stationStates: StationStateRow[],
  currentGlobal: string
): string {
  if (currentGlobal === "cancelled" || currentGlobal === "rejected") {
    return currentGlobal;
  }

  const active = stationStates.filter((row) => row.status !== "cancelled");
  if (active.length === 0) {
    return currentGlobal;
  }

  let candidate: string | null = null;

  if (active.some((row) => row.status === "in_prep")) {
    candidate = "preparing";
  } else if (active.every((row) => row.status === "served")) {
    candidate = "delivered";
  } else if (active.every((row) => READY_PLUS.includes(row.status))) {
    candidate = "ready";
  } else {
    return currentGlobal;
  }

  const currentRank = GLOBAL_STATUS_RANK[currentGlobal] ?? -1;
  const candidateRank = GLOBAL_STATUS_RANK[candidate] ?? -1;
  return candidateRank > currentRank ? candidate : currentGlobal;
}

export type StationPatchRole =
  | "owner"
  | "manager"
  | "staff"
  | "kitchen"
  | "waiter"
  | "bar";

export type RoleGuardResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Server-side guardrails (ADR-043 §4.1a). */
export function assertRoleCanPatchStation(input: {
  role: StationPatchRole;
  station: StationKind;
  fromStatus: StationStatus;
  toStatus: StationStatus;
}): RoleGuardResult {
  const { role, station, fromStatus, toStatus } = input;

  if (!isValidStationTransition(fromStatus, toStatus)) {
    return {
      ok: false,
      reason: `Invalid transition from '${fromStatus}' to '${toStatus}'.`,
    };
  }

  if (role === "owner" || role === "manager") {
    return { ok: true };
  }

  if (role === "bar") {
    if (station !== "bar") {
      return { ok: false, reason: "Bar staff can only update the bar station." };
    }
    if (
      !(
        (fromStatus === "queued" && toStatus === "in_prep") ||
        (fromStatus === "in_prep" && toStatus === "ready")
      )
    ) {
      return {
        ok: false,
        reason: "Bar staff can only move queued → in_prep → ready.",
      };
    }
    return { ok: true };
  }

  if (role === "kitchen") {
    if (station !== "kitchen") {
      return {
        ok: false,
        reason: "Kitchen staff can only update the kitchen station.",
      };
    }
    if (
      !(
        (fromStatus === "queued" && toStatus === "in_prep") ||
        (fromStatus === "in_prep" && toStatus === "ready")
      )
    ) {
      return {
        ok: false,
        reason: "Kitchen staff can only move queued → in_prep → ready.",
      };
    }
    return { ok: true };
  }

  if (role === "waiter") {
    if (
      !(
        (fromStatus === "ready" && toStatus === "picked_up") ||
        (fromStatus === "picked_up" && toStatus === "served")
      )
    ) {
      return {
        ok: false,
        reason: "Waiters can only move ready → picked_up → served.",
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    reason: "Your role cannot update station status.",
  };
}

export type PatchStationStatusResult =
  | {
      ok: true;
      stationStatus: StationStatus;
      globalStatus: string;
      station: StationKind;
      orderId: string;
    }
  | {
      ok: false;
      error:
        | "not_found"
        | "station_not_found"
        | "locked"
        | "invalid_transition"
        | "rpc_error";
      message?: string;
    };

type AdminClient = SupabaseClient<Database>;

export async function patchStationStatus(
  admin: AdminClient,
  input: {
    orderId: string;
    station: StationKind;
    status: StationStatus;
    staffId: string;
  }
): Promise<PatchStationStatusResult> {
  const { data, error } = await admin.rpc("patch_station_status_tx", {
    p_order_id: input.orderId,
    p_station: input.station,
    p_status: input.status,
    p_staff_id: input.staffId,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("order_not_found")) {
      return { ok: false, error: "not_found" };
    }
    if (message.includes("station_state_not_found")) {
      return { ok: false, error: "station_not_found" };
    }
    if (
      message.includes("station_state_locked") ||
      message.includes("invalid_transition")
    ) {
      return {
        ok: false,
        error: message.includes("station_state_locked")
          ? "locked"
          : "invalid_transition",
        message,
      };
    }
    return { ok: false, error: "rpc_error", message };
  }

  const payload = data as {
    station_status: StationStatus;
    global_status: string;
    station: StationKind;
    order_id: string;
  };

  return {
    ok: true,
    stationStatus: payload.station_status,
    globalStatus: payload.global_status,
    station: payload.station,
    orderId: payload.order_id,
  };
}
