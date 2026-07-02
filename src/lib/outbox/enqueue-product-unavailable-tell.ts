import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductUnavailableTellInput = {
  orderId: string;
  sessionId: string;
  locationId: string;
  tableId: string;
  tableToken: string;
  orderNumber: number;
  productId: string;
  productName: string;
  message: string;
};

export async function enqueueProductUnavailableTell(
  admin: SupabaseClient,
  input: ProductUnavailableTellInput
): Promise<void> {
  try {
    await enqueueOutboxEvents(admin, [
      {
        aggregate_type: "session",
        aggregate_id: input.sessionId,
        domain: "commerce",
        event_type: "commerce.denis.world",
        payload: {
          signal: "commerce.product_unavailable",
          orderId: input.orderId,
          sessionId: input.sessionId,
          locationId: input.locationId,
          tableId: input.tableId,
          tableToken: input.tableToken,
          orderNumber: input.orderNumber,
          status: "pending",
          productTell: {
            productId: input.productId,
            productName: input.productName,
            message: input.message,
          },
        },
      },
    ]);
  } catch (error) {
    logger.warn("enqueueProductUnavailableTell failed", {
      orderId: input.orderId,
      productId: input.productId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Fire-and-forget from station 86 paths. */
export function scheduleProductUnavailableTell(
  input: ProductUnavailableTellInput
): void {
  const admin = createAdminClient();
  void enqueueProductUnavailableTell(admin, input).catch((error) => {
    logger.warn("scheduleProductUnavailableTell failed", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
