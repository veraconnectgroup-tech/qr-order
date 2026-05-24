import { handleFulfillCloudPrint } from "@/lib/outbox/handlers/cloud-print";
import { handleFulfillNotifyPosPayment } from "@/lib/outbox/handlers/notify-pos-payment";
import { handleFulfillPushPos } from "@/lib/outbox/handlers/push-pos";
import { handleFiscalBeleg } from "@/lib/outbox/handlers/beleg";
import { handleFulfillNotifyStaff } from "@/lib/outbox/handlers/notify-staff";
import { handleFiscalSendReceipt } from "@/lib/outbox/handlers/send-receipt";
import { handleFiscalTseSign } from "@/lib/outbox/handlers/tse-sign";
import { handleIntegrationWebhook } from "@/lib/outbox/handlers/integration-webhook";
import type { OutboxEventType } from "@/lib/outbox/types";

export type OutboxHandler = (
  payload: Record<string, unknown>
) => Promise<void>;

const handlers: Record<OutboxEventType, OutboxHandler> = {
  "fulfill.notify_staff": handleFulfillNotifyStaff,
  "fulfill.push_pos": handleFulfillPushPos,
  "fulfill.notify_pos_payment": handleFulfillNotifyPosPayment,
  "fulfill.cloud_print": handleFulfillCloudPrint,
  "fiscal.tse_sign": handleFiscalTseSign,
  "fiscal.beleg": handleFiscalBeleg,
  "fiscal.send_receipt": handleFiscalSendReceipt,
  "integration.webhook": handleIntegrationWebhook,
};

export function getOutboxHandler(
  eventType: string
): OutboxHandler | undefined {
  return handlers[eventType as OutboxEventType];
}
