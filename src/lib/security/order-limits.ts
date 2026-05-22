export const MAX_ITEMS_PER_ORDER = 50;
export const MAX_ORDER_AMOUNT = 5000;
export const MAX_QUANTITY_PER_ITEM = 20;
export const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PRICE_EPSILON = 0.02;

export type OrderItemInput = {
  productId: string;
  quantity: number;
  productName?: string;
};

export function validateOrderItems(items: OrderItemInput[]): string | null {
  if (items.length === 0) return "Order is empty";
  if (items.length > MAX_ITEMS_PER_ORDER) return "Too many items in order";

  for (const item of items) {
    if (item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_ITEM) {
      return `Invalid quantity for ${item.productName ?? "item"}`;
    }
  }

  return null;
}

export function validateOrderTotal(total: number): string | null {
  if (total <= 0) return "Invalid order amount";
  if (total > MAX_ORDER_AMOUNT) return "Order amount exceeds limit";
  return null;
}
