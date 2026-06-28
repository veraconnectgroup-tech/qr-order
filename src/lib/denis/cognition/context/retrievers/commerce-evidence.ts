import type { TableSessionState } from "@/lib/denis/loop/types";

/** `commerce.*` pointer — cart + open orders (always on LLM turns). */
export function retrieveCommerceEvidence(
  state: TableSessionState | null | undefined,
  orderContext: string | null | undefined,
  orderDraftContext: string | null | undefined,
  options?: { nowMs?: number }
): string {
  const blocks: string[] = [];

  if (orderDraftContext?.trim()) {
    blocks.push(`ORDER DRAFT:\n${orderDraftContext.trim()}`);
  }

  if (orderContext?.trim()) {
    blocks.push(orderContext.trim());
  }

  if (state) {
    const openOrders = state.commerce.orders.filter(
      (order) =>
        order.status !== "delivered" && order.status !== "cancelled"
    );
    if (openOrders.length > 0) {
      const lines = openOrders.map(
        (order) => {
          const createdMs = new Date(order.createdAt).getTime();
          const waitMinutes =
            options?.nowMs != null && Number.isFinite(createdMs)
              ? Math.max(0, Math.floor((options.nowMs - createdMs) / 60_000))
              : null;
          const estimate = order.estimatedPrepMinutes;
          const confidence = order.prepEstimateConfidence ?? "none";
          const late =
            waitMinutes != null &&
            estimate != null &&
            waitMinutes > estimate;
          const etaLine =
            estimate != null && confidence === "high"
              ? `ETA: ~${estimate} min, high confidence`
              : estimate != null
                ? `ETA: ~${estimate} min`
                : order.status === "preparing" ||
                    order.status === "accepted" ||
                    order.status === "pending"
                  ? "ETA: preparing"
                  : null;
          return [
            `#${order.orderNumber ?? "?"} ${order.status} (${order.items.length} items)`,
            waitMinutes != null ? `guest_waiting: ${waitMinutes} min` : null,
            etaLine,
            estimate != null
              ? late
                ? "LATE, empathy needed"
                : "on track"
              : null,
          ]
            .filter(Boolean)
            .join(" — ");
        }
      );
      blocks.push(`OPEN TABLE ORDERS:\n${lines.join("\n")}`);
    }

    const cartLines = state.commerce.cart.visibleLines;
    if (cartLines.length > 0 && !orderDraftContext?.trim()) {
      const lines = cartLines.map(
        (line) =>
          `${line.quantity}x ${line.productName}${line.serveSize ? ` (${line.serveSize})` : ""}`
      );
      blocks.push(`VISIBLE CART:\n${lines.join("\n")}`);
    }
  }

  return blocks.join("\n\n");
}
