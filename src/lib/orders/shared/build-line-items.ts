import type { MenuSection } from "@/lib/menu-section";
import type { CartItemInput } from "@/lib/orders/create/schema";
import type { ValidatedLineItem } from "@/lib/orders/create/types";
import { sanitizeOrderNotes } from "@/lib/security/sanitize";
import { serveSizeOrderNote } from "@/lib/serve-size";
import { resolveItemTaxRate } from "@/lib/tax/vat";
import type { ModifierRow } from "@/lib/orders/create/pipeline/modifier-catalog";

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  category_id: string;
  tax_rate: number | null;
};

export function buildValidatedLineItems(input: {
  items: CartItemInput[];
  productMap: Map<string, CatalogProduct>;
  modifierMap: Map<string, ModifierRow>;
  categorySectionMap: Map<string, MenuSection>;
  isTakeaway: boolean;
  orgDefaultTaxPercent: number;
}): ValidatedLineItem[] {
  const taxPercent = Number(input.orgDefaultTaxPercent ?? 19);

  return input.items.map((item) => {
    const product = input.productMap.get(item.productId)!;
    const mods = item.modifiers.map((mod) => {
      const serverMod = input.modifierMap.get(mod.modifierId)!;
      return {
        modifierId: serverMod.id,
        modifierName: serverMod.name,
        price: Number(serverMod.price),
      };
    });
    const unitWithMods =
      Number(product.price) + mods.reduce((sum, mod) => sum + mod.price, 0);
    const itemTotal = unitWithMods * item.quantity;

    const serveNote = serveSizeOrderNote(item.serveSize);
    const combinedNotes = [
      serveNote,
      item.notes ? sanitizeOrderNotes(item.notes) : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const menuSection =
      input.categorySectionMap.get(product.category_id) ?? ("food" as MenuSection);
    const productTaxRate =
      product.tax_rate != null ? Number(product.tax_rate) : null;

    return {
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: Number(product.price),
      notes: combinedNotes,
      menuSection,
      productTaxRate,
      taxRate: resolveItemTaxRate({
        productTaxRate,
        menuSection,
        isTakeaway: input.isTakeaway,
        orgDefaultRate: taxPercent,
      }),
      modifiers: mods,
      itemTotal,
    };
  });
}
