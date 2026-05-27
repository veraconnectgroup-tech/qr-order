import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import { getAiRedis } from "@/lib/ai/redis";
import { createOrderFromCart } from "@/lib/orders/create-order";
import { logger } from "@/lib/logger";

export type AiOrderSubmitInput = {
  aiSessionId: string;
  tableToken: string;
  sessionToken?: string;
  deviceFingerprint: string;
  deviceToken?: string;
  draft: AiOrderDraft;
  catalog: AiCatalog;
};

export type AiOrderSubmitResult =
  | {
      data: {
        orderId: string;
        orderNumber: number;
        awaitingApproval?: boolean;
        total: number;
      };
    }
  | { error: string; status: number; blockedUntil?: string };

function draftItemToCartItem(
  draft: AiOrderDraft["items"][number],
  catalog: AiCatalog
) {
  const product = catalog.catalog[draft.productId];
  if (!product) {
    throw new Error("unknown_product");
  }

  const modifiers = draft.modifierIds
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

  return {
    productId: draft.productId,
    productName: draft.productName,
    unitPrice: product.price,
    quantity: draft.quantity,
    notes: draft.notes,
    serveSize: draft.serveSize,
    modifiers,
    itemTotal: draft.lineTotal,
  };
}

async function checkIdempotency(
  aiSessionId: string,
  cartRevision: number
): Promise<{
  orderId: string;
  orderNumber: number;
  total: number;
} | null> {
  const redis = getAiRedis();
  if (!redis) return null;

  const key = `ai:submit:${aiSessionId}:${cartRevision}`;
  const existing = await redis.get<{
    orderId: string;
    orderNumber: number;
    total: number;
  }>(key);
  return existing ?? null;
}

async function storeIdempotency(
  aiSessionId: string,
  cartRevision: number,
  payload: { orderId: string; orderNumber: number; total: number }
) {
  const redis = getAiRedis();
  if (!redis) return;
  const key = `ai:submit:${aiSessionId}:${cartRevision}`;
  await redis.set(key, payload, { ex: 86_400 });
}

export async function submitAiOrderDraft(
  input: AiOrderSubmitInput
): Promise<AiOrderSubmitResult> {
  if (!input.draft.items.length) {
    return { error: "empty_cart", status: 400 };
  }

  if (input.draft.pending) {
    return { error: "Complete your order choices first.", status: 400 };
  }

  const existingOrder = await checkIdempotency(
    input.aiSessionId,
    input.draft.cartRevision
  );
  if (existingOrder) {
    return { data: { ...existingOrder, awaitingApproval: false } };
  }

  let items;
  try {
    items = input.draft.items.map((item) =>
      draftItemToCartItem(item, input.catalog)
    );
  } catch {
    return { error: "Order items are invalid.", status: 400 };
  }

  const result = await createOrderFromCart({
    sessionToken: input.sessionToken,
    tableToken: input.tableToken,
    deviceFingerprint: input.deviceFingerprint,
    deviceToken: input.deviceToken,
    items,
    notes: "",
    guestEmail: "",
    isTakeaway: false,
    paymentMethod: "unset",
  });

  if ("error" in result && result.error) {
    return {
      error: result.error,
      status: result.status ?? 500,
      blockedUntil:
        "blockedUntil" in result ? (result.blockedUntil as string) : undefined,
    };
  }

  const data = result.data as {
    orderId: string;
    orderNumber: number;
    total: number;
    awaitingApproval?: boolean;
  };

  await storeIdempotency(input.aiSessionId, input.draft.cartRevision, {
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    total: data.total,
  });

  logger.info("AI order submitted", {
    aiSessionId: input.aiSessionId,
    orderId: data.orderId,
    orderNumber: data.orderNumber,
  });

  return {
    data: {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      total: data.total,
      awaitingApproval: data.awaitingApproval,
    },
  };
}

export function clearedDraftAfterSubmit(): AiOrderDraft {
  return {
    version: 1,
    items: [],
    pending: null,
    cartRevision: 0,
    updatedAt: new Date().toISOString(),
  };
}
