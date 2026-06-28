import {
  handleBillingLowBalance,
  handleBillingStaffHint,
} from "@/lib/outbox/handlers/billing-low-balance";
import { handleActionableInsightsDigest } from "@/lib/outbox/handlers/actionable-insights-digest";
import { handleBillingTrialEnding } from "@/lib/outbox/handlers/billing-trial-ending";
import { handleBillingUsageExceeded } from "@/lib/outbox/handlers/billing-usage-exceeded";
import { handleCommerceProjectionRefresh } from "@/lib/commerce/projections/refresh-session-state";
import { handleCommerceDenisWorld } from "@/lib/outbox/handlers/commerce-denis-world";
import { handleCommerceStaffAlert } from "@/lib/outbox/handlers/commerce-staff-alert";
import { handleCommercePreorderRelease } from "@/lib/outbox/handlers/commerce-preorder-release";
import { handleSceneRefresh } from "@/lib/scene/refresh-guest-scene";
import { handleSessionEval } from "@/lib/outbox/handlers/session-eval";
import { handleFulfillCloudPrint } from "@/lib/outbox/handlers/cloud-print";
import { handleSessionPaidOnline } from "@/lib/outbox/handlers/session-paid-online";
import { handleFulfillPushPos } from "@/lib/outbox/handlers/push-pos";
import { handleFiscalBeleg } from "@/lib/outbox/handlers/beleg";
import { handleFulfillNotifyStaff } from "@/lib/outbox/handlers/notify-staff";
import { handleFiscalSendReceipt } from "@/lib/outbox/handlers/send-receipt";
import { handleFiscalTseSign } from "@/lib/outbox/handlers/tse-sign";
import { handleIntegrationWebhook } from "@/lib/outbox/handlers/integration-webhook";
import { handleNotificationSmsSend } from "@/lib/outbox/handlers/sms-send";
import { handleNotificationWhatsAppSend } from "@/lib/outbox/handlers/whatsapp-send";
import type { OutboxEventType } from "@/lib/outbox/types";

export type OutboxHandler = (
  payload: Record<string, unknown>
) => Promise<void>;

const handlers: Record<OutboxEventType, OutboxHandler> = {
  "fulfill.notify_staff": handleFulfillNotifyStaff,
  "fulfill.push_pos": handleFulfillPushPos,
  "session.paid_online": handleSessionPaidOnline,
  "fulfill.cloud_print": handleFulfillCloudPrint,
  "fiscal.tse_sign": handleFiscalTseSign,
  "fiscal.beleg": handleFiscalBeleg,
  "fiscal.send_receipt": handleFiscalSendReceipt,
  "integration.webhook": handleIntegrationWebhook,
  "billing.low_balance": handleBillingLowBalance,
  "billing.staff_hint": handleBillingStaffHint,
  "billing.trial_ending": handleBillingTrialEnding,
  "billing.usage_exceeded": handleBillingUsageExceeded,
  "billing.actionable_insights": handleActionableInsightsDigest,
  "commerce.projection.refresh": handleCommerceProjectionRefresh,
  "commerce.alert.staff": handleCommerceStaffAlert,
  "commerce.denis.world": handleCommerceDenisWorld,
  "commerce.preorder.release": handleCommercePreorderRelease,
  "session.scene.refresh": handleSceneRefresh,
  "session.eval": handleSessionEval,
  "notification.sms.send": handleNotificationSmsSend,
  "notification.whatsapp.send": handleNotificationWhatsAppSend,
};

export function getOutboxHandler(
  eventType: string
): OutboxHandler | undefined {
  return handlers[eventType as OutboxEventType];
}
