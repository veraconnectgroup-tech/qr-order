import {
  getProductStockImage,
  PRODUCT_STOCK_IMAGES,
} from "@/lib/product-stock-images";

/** Stock photos + allergen labels for demo menu items */
export function getDemoProductMedia(id: string, name: string) {
  const stock = PRODUCT_STOCK_IMAGES[id] ?? getProductStockImage(name);
  if (!stock) return undefined;

  return {
    imageUrl: stock.imageUrl,
    allergens: stock.allergens,
  };
}
