import { maybeSendOrderReceipt } from "@/lib/email/send-order-receipt";
import { logger } from "@/lib/logger";

export async function handleFiscalSendReceipt(
  payload: Record<string, unknown>
): Promise<void> {
  const orderId = payload.orderId;
  if (typeof orderId !== "string" || !orderId) {
    throw new Error("fiscal.send_receipt missing orderId");
  }

  await maybeSendOrderReceipt(orderId);

  logger.info("Outbox fiscal.send_receipt processed", { orderId });
}
