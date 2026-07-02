import { resilientFetch } from "@/lib/fetch/resilient-fetch";
import type { StationKind, StationStatus } from "@/lib/orders/station-states";

export async function patchOrderStatus(
  orderId: string,
  status:
    | "accepted"
    | "preparing"
    | "ready"
    | "delivered"
    | "rejected"
    | "cancelled",
  rejectionReason?: string
) {
  const { error } = await resilientFetch<{ data: unknown; error: string | null }>(
    `/api/orders/${orderId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejectionReason }),
    }
  );

  if (error) {
    throw new Error(error);
  }
}

export type KitchenAdvanceAction =
  | { kind: "global"; status: "accepted" | "preparing" | "ready" | "delivered" }
  | { kind: "station"; station: "kitchen"; status: StationStatus };

export type BarAdvanceAction =
  | { kind: "global"; status: "accepted" | "preparing" | "ready" }
  | { kind: "station"; station: "bar"; status: StationStatus };

export async function patchStationStatusClient(
  orderId: string,
  station: StationKind,
  status: StationStatus
): Promise<{
  stationStatus: StationStatus;
  globalStatus: string;
}> {
  const { data, error } = await resilientFetch<{
    ok: boolean;
    data: {
      stationStatus: StationStatus;
      globalStatus: string;
    } | null;
    error: string | null;
  }>(`/api/orders/${orderId}/station-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station, status }),
  });

  if (error || !data?.data) {
    throw new Error(error ?? "Station status update failed.");
  }

  return data.data;
}

export async function executeKitchenAdvanceAction(
  orderId: string,
  action: KitchenAdvanceAction
): Promise<{ globalStatus?: string; stationStatus?: StationStatus }> {
  if (action.kind === "global") {
    await patchOrderStatus(orderId, action.status);
    return { globalStatus: action.status };
  }
  const result = await patchStationStatusClient(
    orderId,
    action.station,
    action.status
  );
  return {
    globalStatus: result.globalStatus,
    stationStatus: result.stationStatus,
  };
}

export async function executeBarAdvanceAction(
  orderId: string,
  action: BarAdvanceAction
): Promise<{ globalStatus?: string; stationStatus?: StationStatus }> {
  if (action.kind === "global") {
    await patchOrderStatus(orderId, action.status);
    return { globalStatus: action.status };
  }
  const result = await patchStationStatusClient(
    orderId,
    action.station,
    action.status
  );
  return {
    globalStatus: result.globalStatus,
    stationStatus: result.stationStatus,
  };
}

export function nextKdsStatus(
  status: string
): "accepted" | "preparing" | "ready" | "delivered" | null {
  switch (status) {
    case "pending":
      return "accepted";
    case "accepted":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return "delivered";
    default:
      return null;
  }
}

export function kdsActionLabel(status: string): string | null {
  switch (status) {
    case "pending":
      return "Accept";
    case "accepted":
      return "Start preparing";
    case "preparing":
      return "Ready";
    case "ready":
      return "Delivered";
    default:
      return null;
  }
}
