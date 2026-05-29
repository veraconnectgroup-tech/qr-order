import type { TableSessionState } from "@/lib/denis/loop/types";

/** `commerce.*` pointer — cart + open orders (always on LLM turns). */
export function retrieveCommerceEvidence(
  state: TableSessionState | null | undefined,
  orderContext: string | null | undefined,
  orderDraftContext: string | null | undefined
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
        (order) =>
          `#${order.orderNumber ?? "?"} ${order.status} (${order.items.length} items)`
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
