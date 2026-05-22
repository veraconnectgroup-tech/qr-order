import { getProductStockImage } from "@/lib/product-stock-images";

/** Stock photos + allergen labels for demo menu items */
export function getDemoProductMedia(name: string) {
  const stock = getProductStockImage(name);
  if (!stock) return undefined;

  return {
    imageUrl: stock.imageUrl,
    allergens: stock.allergens,
  };
}
