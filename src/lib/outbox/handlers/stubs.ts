import { logger } from "@/lib/logger";

/** Track C/D — no-op until POS / CloudPRNT adapters ship; avoids infinite retry. */
export async function handleFulfillPushPos(
  payload: Record<string, unknown>
): Promise<void> {
  logger.info("Outbox fulfill.push_pos deferred (Track C)", {
    orderId: payload.orderId,
    provider: payload.provider,
  });
}

export async function handleFulfillCloudPrint(
  payload: Record<string, unknown>
): Promise<void> {
  logger.info("Outbox fulfill.cloud_print deferred (Track D)", {
    orderId: payload.orderId,
    printerId: payload.printerId,
  });
}
