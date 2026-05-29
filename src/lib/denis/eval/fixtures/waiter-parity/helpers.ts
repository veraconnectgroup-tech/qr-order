import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";

export function drinkLine(
  productId: string,
  productName: string,
  serveSize: string | null = null,
  quantity = 1
): DenisCartLine {
  return {
    productId,
    productName,
    quantity,
    serveSize,
    modifierIds: [],
    notes: "",
    lineTotal: 4.5,
    menuSection: "drinks",
  };
}

export const BEER_SERVE_OPTIONS = ["0.3L", "0.5L"];
