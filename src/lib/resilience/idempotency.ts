import type { IdempotentOrderData } from "@/lib/orders/idempotency";
import { getRedisClient } from "@/lib/redis/client";

const ORDER_IDEM_REDIS_PREFIX = "idem:order:";
const ORDER_IDEM_TTL_SECONDS = 60 * 60;

export function buildPaymentIdempotencyKey(
  orgId: string,
  orderId: string,
  amountCents: number
): string {
  return `pay:${orgId}:${orderId}:${amountCents}`;
}

type CartIdempotencyItem = {
  productId: string;
  quantity: number;
  modifiers?: { modifierId: string }[];
  serveSize?: string | null;
};

function hashCartContents(items: CartIdempotencyItem[]): string {
  const normalized = items
    .map((item) => ({
      p: item.productId,
      q: item.quantity,
      s: item.serveSize ?? "",
      m: (item.modifiers ?? [])
        .map((mod) => mod.modifierId)
        .sort()
        .join(","),
    }))
    .sort((a, b) => `${a.p}:${a.m}`.localeCompare(`${b.p}:${b.m}`));

  const payload = JSON.stringify(normalized);
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildGuestOrderIdempotencyKey(
  sessionId: string,
  items: CartIdempotencyItem[]
): string {
  return `order:${sessionId}:${hashCartContents(items)}`;
}

export async function getCachedOrderIdempotency(
  key: string
): Promise<IdempotentOrderData | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get<IdempotentOrderData>(`${ORDER_IDEM_REDIS_PREFIX}${key}`);
  } catch {
    return null;
  }
}

export async function cacheOrderIdempotency(
  key: string,
  data: IdempotentOrderData
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(`${ORDER_IDEM_REDIS_PREFIX}${key}`, data, {
      ex: ORDER_IDEM_TTL_SECONDS,
    });
  } catch {
    // Redis unavailable — DB idempotency still applies.
  }
}
