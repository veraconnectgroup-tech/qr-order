import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type { DenisOrderCommand } from "@/lib/denis/acl/denis-order-command.schema";
import type { CartItemInput } from "@/lib/orders/create/schema";

const PRICE_EPSILON = 0.02;

export function mapDenisOrderCommandToCartItems(
  command: DenisOrderCommand,
  catalog: AiCatalog
): { ok: true; items: CartItemInput[] } | { ok: false; error: string } {
  const items: CartItemInput[] = [];

  for (const line of command.lines) {
    const product = catalog.catalog[line.productId];
    if (!product) {
      return { ok: false, error: `Unknown product ${line.productId}` };
    }

    const modifiers = line.modifierIds
      .map((id) => {
        for (const group of product.modifierGroups) {
          const mod = group.modifiers.find((row) => row.id === id);
          if (mod) {
            return {
              modifierId: mod.id,
              modifierName: mod.name,
              price: mod.price,
            };
          }
        }
        return null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const modifierTotal = modifiers.reduce((sum, mod) => sum + mod.price, 0);
    const unitTotal = Number(product.price) + modifierTotal;

    if (Math.abs(unitTotal - line.expectedUnitPrice) > PRICE_EPSILON) {
      return {
        ok: false,
        error: `Price mismatch for ${product.name}`,
      };
    }

    items.push({
      productId: line.productId,
      productName: product.name,
      unitPrice: unitTotal,
      quantity: line.quantity,
      notes: line.notes,
      serveSize: line.serveSize,
      modifiers,
      itemTotal: unitTotal * line.quantity,
    });
  }

  return { ok: true, items };
}
