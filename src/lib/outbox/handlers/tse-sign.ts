import { signOrderTransactionById } from "@/lib/fiscal/sign-transaction";
import { logger } from "@/lib/logger";

export async function handleFiscalTseSign(
  payload: Record<string, unknown>
): Promise<void> {
  const orderId = payload.orderId;
  if (typeof orderId !== "string" || !orderId) {
    throw new Error("fiscal.tse_sign missing orderId");
  }

  const result = await signOrderTransactionById(orderId);

  logger.info("Outbox fiscal.tse_sign processed", {
    orderId,
    signed: result != null,
    alreadySigned: result == null,
  });
}
