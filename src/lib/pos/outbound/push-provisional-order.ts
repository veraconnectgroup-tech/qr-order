import { getPosAdapter } from "@/lib/pos/adapter-registry";
import type { PosOrderPayload } from "@/lib/pos/types";
import type { ProvisionalOrderPayload } from "@/lib/pos/provisional-types";

export type PushProvisionalOrderInput = {
  provider: string;
  config: Record<string, unknown>;
  tableName: string;
  currency: string;
  payload: ProvisionalOrderPayload;
};

/** Outbound — POS sees provisional order before guest confirms (Prompt 39). */
export async function pushProvisionalOrderToPos(
  input: PushProvisionalOrderInput
) {
  const adapter = getPosAdapter(input.provider);
  if (!adapter) {
    return {
      success: false,
      skipped: true,
      error: `no_adapter:${input.provider}`,
    };
  }

  const posPayload: PosOrderPayload = {
    orderId: input.payload.clientOrderId,
    orderNumber: 0,
    locationId: input.payload.locationId,
    externalLocationId: null,
    tableName: input.tableName,
    total: input.payload.total,
    currency: input.currency,
    paymentState: "UNPAID",
    items: input.payload.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPrice: 0,
      total: 0,
      notes: item.notes ?? null,
      taxRate: 19,
      modifiers: [],
    })),
    createdAt: input.payload.createdAt,
  };

  return adapter.pushOrder(posPayload, {
    ...input.config,
    provisional: true,
  });
}
