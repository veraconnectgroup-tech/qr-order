import { logger } from "@/lib/logger";

/** Track D — no-op until CloudPRNT adapters ship; avoids infinite retry. */
export async function handleFulfillCloudPrint(
  payload: Record<string, unknown>
): Promise<void> {
  logger.info("Outbox fulfill.cloud_print deferred (Track D)", {
    orderId: payload.orderId,
    printerId: payload.printerId,
  });
}
