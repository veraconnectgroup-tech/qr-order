import type { CreateOrderInput } from "@/lib/orders/create-order";
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
  PRICE_EPSILON,
  validateOrderItems,
} from "@/lib/security/order-limits";
import { sanitizeOrderNotes } from "@/lib/security/sanitize";
import { serveSizeOrderNote } from "@/lib/serve-size";
import { resolveItemTaxRate } from "@/lib/tax/vat";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

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

  const allProducts = (productsRes.data ?? []) as Array<{
    id: string;
    name: string;
    price: number;
    is_available: boolean;
    location_id: string;
    category_id: string;
    tax_rate: number | null;
  }>;

  const unavailableNames = productIds
    .map((id) => allProducts.find((product) => product.id === id))
    .filter((product) => !product || !product.is_available)
    .map((product) => product?.name ?? "Unknown product");

  if (unavailableNames.length > 0) {
    return err(
      orderError("unavailable_products", "unavailable_products", 400, {
        products: unavailableNames,
      })
    );
  }

  const productMap = new Map(allProducts.map((product) => [product.id, product]));

  if (productMap.size !== productIds.length) {
    return err(
      orderError(
        "unavailable_products",
        "One or more products are unavailable.",
        400
      )
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

  const taxPercent = Number(ctx.org.default_tax_percent ?? 19);

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

  const lineItems: ValidatedLineItem[] = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    const mods = item.modifiers.map((mod) => {
      const serverMod = modifierMap.get(mod.modifierId)!;
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
      categorySectionMap.get(product.category_id) ?? ("food" as MenuSection);
    const productTaxRate =
      product.tax_rate != null ? Number(product.tax_rate) : null;
    const taxRate = resolveItemTaxRate({
      productTaxRate,
      menuSection,
      isTakeaway: input.isTakeaway,
      orgDefaultRate: taxPercent,
    });

    return {
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: Number(product.price),
      notes: combinedNotes,
      menuSection,
      productTaxRate,
      taxRate,
      modifiers: mods,
      itemTotal,
    };
  });

  return ok(lineItems);
}
