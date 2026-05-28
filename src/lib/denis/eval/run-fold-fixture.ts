import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { orderFactsFromSubmit } from "@/lib/denis/loop/load-order-facts";
import type { TableSessionState } from "@/lib/denis/loop/types";

export type FoldOrderVisibilityResult = {
  passed: boolean;
  errors: string[];
  orderCount: number;
};

/** Golden fixture — after mock submit, FOLD commerce.orders includes the order. */
export function runFoldOrderVisibilityFixture(): FoldOrderVisibilityResult {
  const errors: string[] = [];
  const orders = orderFactsFromSubmit({
    orderId: "order-fixture-1",
    orderNumber: 42,
    items: [{ productName: "Craft IPA", quantity: 2 }],
  });

  const cart = buildMergedCart({ ai: emptyCartState() });

  const partialState = {
    commerce: { orders, cart },
  } as Pick<TableSessionState, "commerce">;

  if (partialState.commerce.orders.length !== 1) {
    errors.push(
      `expected 1 order in commerce.orders, got ${partialState.commerce.orders.length}`
    );
  }

  const order = partialState.commerce.orders[0];
  if (order?.orderNumber !== 42) {
    errors.push(`expected orderNumber 42, got ${order?.orderNumber ?? "null"}`);
  }

  if (partialState.commerce.cart.visibleLines.length !== 0) {
    errors.push("empty cart should have no visible lines before merge");
  }

  return {
    passed: errors.length === 0,
    errors,
    orderCount: partialState.commerce.orders.length,
  };
}
