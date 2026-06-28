import { maybeSendOrderReceipt } from "@/lib/email/send-order-receipt";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function handleFiscalSendReceipt(
  payload: Record<string, unknown>
): Promise<void> {
  const orderId = payload.orderId;
  if (typeof orderId !== "string" || !orderId) {
    throw new Error("fiscal.send_receipt missing orderId");
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("beleg_token, tse_signature, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  const row = order as {
    beleg_token: string | null;
    tse_signature: string | null;
    payment_status: string;
  } | null;

  const channels: string[] = ["email_html"];
  if (row?.beleg_token) {
    channels.push("qr_beleg");
  }
  if (row?.tse_signature) {
    channels.push("fiscal_beleg");
  }

  await maybeSendOrderReceipt(orderId);

  logger.info("Outbox fiscal.send_receipt processed", {
    orderId,
    channels,
    paymentStatus: row?.payment_status,
  });
}
