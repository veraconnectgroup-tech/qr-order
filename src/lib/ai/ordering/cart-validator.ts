import type { AiCatalog, AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type {
  AiPendingItem,
  AiPendingMissing,
  AiProposedItem,
  ValidatedCartAction,
} from "@/lib/ai/ordering/draft-types";
import { formatServeSize, isValidServeSize } from "@/lib/serve-size";

export type ItemValidationResult =
  | { ok: true; action: ValidatedCartAction }
  | { ok: false; pending: AiPendingItem };

function normalizeServeSize(value: string | null | undefined, product: AiCatalogProduct) {
  if (!value?.trim()) return null;
  const formatted = formatServeSize(value.trim());
  const presets = product.serveSizePresets.map((p) => formatServeSize(p));

  const exact = presets.find(
    (p) => p.toLowerCase() === formatted.toLowerCase()
  );
  if (exact) return exact;

  const numeric = formatted.replace(/l$/i, "").trim();
  const byNumeric = presets.find(
    (p) => p.replace(/l$/i, "").trim() === numeric
  );
  if (byNumeric) return byNumeric;

  if (product.allowCustomServeSize && isValidServeSize(formatted)) {
    return formatted;
  }

  return null;
}

function findMissingChoices(
  product: AiCatalogProduct,
  modifierIds: string[],
  serveSize: string | null
): AiPendingMissing[] {
  const missing: AiPendingMissing[] = [];

  if (product.requiresServeSize && !serveSize) {
    missing.push({
      kind: "serveSize",
      options: product.serveSizePresets.map((p) => formatServeSize(p)),
    });
  }

  for (const group of product.modifierGroups) {
    const selectedInGroup = modifierIds.filter((id) =>
      group.modifiers.some((m) => m.id === id)
    );

    if (group.isRequired && selectedInGroup.length < group.minSelect) {
      missing.push({
        kind: "modifierGroup",
        groupId: group.id,
        groupName: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        options: group.modifiers.map((m) => ({
          id: m.id,
          name: m.name,
          price: m.price,
        })),
      });
    }
  }

  return missing;
}

function buildValidatedAction(
  product: AiCatalogProduct,
  input: AiProposedItem,
  serveSize: string | null
): ValidatedCartAction {
  const modifiers = input.modifierIds
    .map((id) => {
      for (const group of product.modifierGroups) {
        const mod = group.modifiers.find((m) => m.id === id);
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
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const modifierTotal = modifiers.reduce((sum, m) => sum + m.price, 0);
  const lineTotal = (product.price + modifierTotal) * input.quantity;

  return {
    productId: product.id,
    productName: product.name,
    unitPrice: product.price,
    quantity: input.quantity,
    notes: input.notes,
    serveSize,
    menuSection: product.menuSection,
    productTaxRate: product.taxRate,
    modifiers,
    lineTotal,
  };
}

export function validateProposedItem(
  catalog: AiCatalog,
  item: AiProposedItem
): ItemValidationResult {
  const product = catalog.catalog[item.productId];
  if (!product) {
    throw new Error("unknown_product");
  }

  const validModifierIds: string[] = [];
  for (const modId of item.modifierIds) {
    const belongs = product.modifierGroups.some((g) =>
      g.modifiers.some((m) => m.id === modId)
    );
    if (!belongs) {
      throw new Error("invalid_modifier");
    }
    validModifierIds.push(modId);
  }

  for (const group of product.modifierGroups) {
    const count = validModifierIds.filter((id) =>
      group.modifiers.some((m) => m.id === id)
    ).length;
    if (count > group.maxSelect) {
      throw new Error("modifier_max_exceeded");
    }
  }

  const serveSize = product.requiresServeSize
    ? normalizeServeSize(item.serveSize, product)
    : item.serveSize
      ? normalizeServeSize(item.serveSize, product)
      : null;

  const missing = findMissingChoices(product, validModifierIds, serveSize);
  if (missing.length > 0) {
    return {
      ok: false,
      pending: {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        modifierIds: validModifierIds,
        notes: item.notes,
        missing,
      },
    };
  }

  return {
    ok: true,
    action: buildValidatedAction(
      product,
      { ...item, modifierIds: validModifierIds },
      serveSize
    ),
  };
}

export function validateProposedItems(
  catalog: AiCatalog,
  items: AiProposedItem[]
): {
  cartActions: ValidatedCartAction[];
  pending: AiPendingItem | null;
} {
  const cartActions: ValidatedCartAction[] = [];
  let pending: AiPendingItem | null = null;

  for (const item of items) {
    const result = validateProposedItem(catalog, item);
    if (result.ok) {
      cartActions.push(result.action);
    } else if (!pending) {
      pending = result.pending;
    }
  }

  return { cartActions, pending };
}
