import type { CreateOrderInput } from "@/lib/orders/create/schema";
import type { MenuSection } from "@/lib/menu-section";
import {
  err,
  ok,
  type OrderCreateError,
  type Result,
} from "@/lib/orders/create/result";
import { orderError } from "@/lib/orders/create/pipeline/errors";
import { loadModifierMap } from "@/lib/orders/create/pipeline/modifier-catalog";
import type { ResolvedContext, ValidatedLineItem } from "@/lib/orders/create/types";
import {
  buildValidatedLineItems,
  type CatalogProduct,
} from "@/lib/orders/shared/build-line-items";
import {
  PRICE_EPSILON,
  validateOrderItems,
} from "@/lib/security/order-limits";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export function resolveUnavailableProductNames({
  productIds,
  products,
  items,
}: {
  productIds: string[];
  products: Array<CatalogProduct & { is_available: boolean }>;
  items: CreateOrderInput["items"];
}): string[] {
  return productIds
    .map((id) => {
      const product = products.find((row) => row.id === id);
      if (product?.is_available) return null;
      return (
        product?.name ??
        items.find((item) => item.productId === id)?.productName ??
        "This item"
      );
    })
    .filter((name): name is string => Boolean(name))
    .map((name) => name.trim())
    .filter(Boolean);
}

export async function validateOrderCart(
  admin: AdminClient,
  input: CreateOrderInput,
  ctx: ResolvedContext
): Promise<Result<ValidatedLineItem[], OrderCreateError>> {
  const itemsError = validateOrderItems(
    input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      productName: item.productName,
    }))
  );

  if (itemsError) {
    return err(orderError("invalid_input", itemsError, 400));
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const modifierIds = [
    ...new Set(
      input.items.flatMap((item) => item.modifiers.map((mod) => mod.modifierId))
    ),
  ];

  const [productsRes, modifierMap] = await Promise.all([
    admin
      .from("products")
      .select("id, name, price, is_available, location_id, category_id, tax_rate")
      .in("id", productIds)
      .eq("location_id", ctx.table.location_id)
      .is("deleted_at", null),
    loadModifierMap(admin, modifierIds, productIds),
  ]);

  const allProducts = (productsRes.data ?? []) as Array<
    CatalogProduct & { is_available: boolean }
  >;

  const unavailableNames = resolveUnavailableProductNames({
    productIds,
    products: allProducts,
    items: input.items,
  });

  if (unavailableNames.length > 0) {
    return err(
      orderError("unavailable_products", "unavailable_products", 400, {
        products: unavailableNames,
      })
    );
  }

  const productMap = new Map(allProducts.map((product) => [product.id, product]));

  if (productMap.size !== productIds.length) {
    const missingNames = productIds
      .filter((id) => !productMap.has(id))
      .map(
        (id) =>
          input.items.find((item) => item.productId === id)?.productName ??
          "This item"
      );

    return err(
      orderError("unavailable_products", "unavailable_products", 400, {
        products: missingNames,
      })
    );
  }

  const categoryIds = [
    ...new Set([...productMap.values()].map((product) => product.category_id)),
  ];

  const { data: categories } = await admin
    .from("categories")
    .select("id, menu_section")
    .in("id", categoryIds)
    .is("deleted_at", null);

  const categorySectionMap = new Map(
    (categories ?? []).map((category) => [
      (category as { id: string }).id,
      (category as { menu_section: string }).menu_section as MenuSection,
    ])
  );

  if (modifierIds.length > 0 && modifierMap.size !== modifierIds.length) {
    return err(
      orderError(
        "invalid_input",
        "One or more modifiers are unavailable.",
        400
      )
    );
  }

  for (const item of input.items) {
    const product = productMap.get(item.productId)!;
    const serverUnitPrice = Number(product.price);

    if (Math.abs(item.unitPrice - serverUnitPrice) > PRICE_EPSILON) {
      return err(
        orderError(
          "price_mismatch",
          "Price mismatch detected. Please refresh the menu.",
          400
        )
      );
    }

    for (const mod of item.modifiers) {
      const serverMod = modifierMap.get(mod.modifierId);
      if (!serverMod) continue;
      if (Math.abs(mod.price - Number(serverMod.price)) > PRICE_EPSILON) {
        return err(
          orderError(
            "price_mismatch",
            "Modifier price mismatch detected. Please refresh the menu.",
            400
          )
        );
      }
    }
  }

  return ok(
    buildValidatedLineItems({
      items: input.items,
      productMap,
      modifierMap,
      categorySectionMap,
      isTakeaway: input.isTakeaway,
      orgDefaultTaxPercent: ctx.org.default_tax_percent,
    })
  );
}
