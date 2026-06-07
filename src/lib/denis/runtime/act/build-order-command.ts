import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type { DenisOrderCommand } from "@/lib/denis/acl/denis-order-command.schema";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";

/** Align snapshot line totals with live catalog before ACL price check. */
export function reconcileCartDraftPricesFromCatalog(
  cartDraft: DenisCartDraft,
  catalog: AiCatalog
): DenisCartDraft {
  return {
    ...cartDraft,
    items: cartDraft.items.map((line) => {
      const product = catalog.catalog[line.productId];
      if (!product) return line;
      const unit = Number(product.price);
      return {
        ...line,
        lineTotal: unit * Math.max(1, line.quantity),
      };
    }),
  };
}

export function buildDenisOrderCommand(input: {
  aiSessionId: string;
  tableToken: string;
  sessionToken?: string;
  deviceFingerprint: string;
  deviceToken?: string;
  cartDraft: DenisCartDraft;
}): DenisOrderCommand | null {
  if (!input.cartDraft.items.length) return null;

  return {
    idempotencyKey: `${input.aiSessionId}:${input.cartDraft.cartRevision}`,
    aiSessionId: input.aiSessionId,
    tableToken: input.tableToken,
    sessionToken: input.sessionToken,
    deviceFingerprint: input.deviceFingerprint,
    deviceToken: input.deviceToken,
    lines: input.cartDraft.items.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      serveSize: line.serveSize,
      modifierIds: line.modifierIds,
      notes: line.notes,
      expectedUnitPrice: line.lineTotal / Math.max(1, line.quantity),
    })),
  };
}
