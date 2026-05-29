import { mapDenisOrderCommandToCartItems } from "@/lib/denis/acl/map-command-to-cart";
import {
  DenisOrderCommandSchema,
  type DenisOrderCommand,
} from "@/lib/denis/acl/denis-order-command.schema";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import { getAiRedis } from "@/lib/ai/redis";
import { createOrderFromCart } from "@/lib/orders/create-order";
import type { CreateOrderSuccess } from "@/lib/orders/create/types";
import type { OrderSessionOpened } from "@/lib/orders/create/types";
import { logger } from "@/lib/logger";

export type DenisOrderAck = {
  orderId: string;
  orderNumber: number;
  total: number;
  awaitingApproval?: boolean;
  sessionOpened?: OrderSessionOpened;
};

export type ExecuteDenisOrderCommandResult =
  | { ok: true; data: DenisOrderAck; idempotentReplay?: boolean }
  | { ok: false; error: string; status: number };

async function readIdempotency(
  key: string
): Promise<DenisOrderAck | null> {
  const redis = getAiRedis();
  if (!redis) return null;
  return (await redis.get<DenisOrderAck>(key)) ?? null;
}

async function writeIdempotency(key: string, ack: DenisOrderAck): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;
  await redis.set(key, ack, { ex: 86_400 });
}

/**
 * M23 — sole Denis path to Order Core create path.
 */
export async function executeDenisOrderCommand(input: {
  command: DenisOrderCommand;
  catalog: AiCatalog;
}): Promise<ExecuteDenisOrderCommandResult> {
  const parsed = DenisOrderCommandSchema.safeParse(input.command);
  if (!parsed.success) {
    return { ok: false, error: "Invalid order command.", status: 400 };
  }

  const command = parsed.data;
  const idemKey = `denis:submit:${command.idempotencyKey}`;

  const existing = await readIdempotency(idemKey);
  if (existing) {
    return { ok: true, data: existing, idempotentReplay: true };
  }

  const mapped = mapDenisOrderCommandToCartItems(command, input.catalog);
  if (!mapped.ok) {
    return { ok: false, error: mapped.error, status: 400 };
  }

  const result = await createOrderFromCart({
    sessionToken: command.sessionToken,
    tableToken: command.tableToken,
    deviceFingerprint: command.deviceFingerprint,
    deviceToken: command.deviceToken,
    items: mapped.items,
    notes: "",
    guestEmail: "",
    isTakeaway: false,
    paymentMethod: "unset",
  });

  if ("error" in result && result.error) {
    return {
      ok: false,
      error: result.error,
      status: result.status ?? 500,
    };
  }

  if (!result.data) {
    return { ok: false, error: "Order failed.", status: 500 };
  }

  const data = result.data as CreateOrderSuccess;
  const ack: DenisOrderAck = {
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    total: data.total,
    awaitingApproval: data.awaitingApproval,
    sessionOpened: data.sessionOpened,
  };

  await writeIdempotency(idemKey, ack);

  logger.info("Denis ACL order submitted", {
    aiSessionId: command.aiSessionId,
    orderId: ack.orderId,
    orderNumber: ack.orderNumber,
  });

  return { ok: true, data: ack };
}
