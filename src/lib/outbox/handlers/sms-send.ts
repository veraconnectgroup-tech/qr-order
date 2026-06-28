import { sendSms } from "@/lib/notifications/sms-provider";
import { logger } from "@/lib/logger";

export async function handleNotificationSmsSend(
  payload: Record<string, unknown>
): Promise<void> {
  const phone = payload.phone;
  const body = payload.body;
  const templateId = payload.templateId;

  if (typeof phone !== "string" || typeof body !== "string") {
    throw new Error("notification.sms.send missing phone or body");
  }

  const result = await sendSms({
    to: phone,
    body,
    templateId: typeof templateId === "string" ? templateId : undefined,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  if ("skipped" in result) {
    logger.warn("notification.sms.send skipped", {
      reason: result.reason,
      templateId,
    });
    return;
  }

  logger.info("notification.sms.send delivered", {
    templateId,
    provider: result.provider,
    messageId: result.messageId,
  });
}
