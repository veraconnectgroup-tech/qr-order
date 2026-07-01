import { sendWhatsApp } from "@/lib/notifications/whatsapp-provider";
import { logger } from "@/lib/logger";

export async function handleNotificationWhatsAppSend(
  payload: Record<string, unknown>
): Promise<void> {
  const phone = payload.phone;
  const body = payload.body;
  const templateId = payload.templateId;

  if (typeof phone !== "string" || typeof body !== "string") {
    throw new Error("notification.whatsapp.send missing phone or body");
  }

  const result = await sendWhatsApp({
    to: phone,
    body,
    templateId: typeof templateId === "string" ? templateId : undefined,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  if ("skipped" in result) {
    logger.warn("notification.whatsapp.send skipped", {
      reason: result.reason,
      templateId,
    });
    return;
  }

  logger.info("notification.whatsapp.send delivered", {
    templateId,
    messageId: result.messageId,
  });
}
