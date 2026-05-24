import { resilientFetch } from "@/lib/fetch/resilient-fetch";

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
