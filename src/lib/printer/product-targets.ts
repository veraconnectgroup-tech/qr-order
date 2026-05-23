import type { PrinterTarget } from "@/lib/printer/types";

type ProductRow = {
  id: string;
  category_id: string | null;
};

type CategoryRow = {
  id: string;
  printer_target: PrinterTarget;
};

export function buildProductTargetMap(
  products: ProductRow[],
  categories: CategoryRow[]
): Record<string, PrinterTarget> {
  const categoryTarget = new Map(
    categories.map((category) => [category.id, category.printer_target])
  );

  const map: Record<string, PrinterTarget> = {};
  for (const product of products) {
    if (!product.category_id) continue;
    const target = categoryTarget.get(product.category_id);
    if (target) {
      map[product.id] = target;
    }
  }

  return map;
}
