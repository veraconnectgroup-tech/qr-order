import type { DenisOrderCommand } from "@/lib/denis/acl/denis-order-command.schema";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";

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
