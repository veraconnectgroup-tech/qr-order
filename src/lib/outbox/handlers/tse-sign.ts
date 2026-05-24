import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { signOrderTransactionById } from "@/lib/fiscal/sign-transaction";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function handleFiscalTseSign(
  payload: Record<string, unknown>
): Promise<void> {
  const orderId = payload.orderId;
  if (typeof orderId !== "string" || !orderId) {
    throw new Error("fiscal.tse_sign missing orderId");
  }

  const guestEmail =
    typeof payload.guestEmail === "string" && payload.guestEmail.trim()
      ? payload.guestEmail.trim()
      : null;

  await signOrderTransactionById(orderId);

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("tse_signature")
    .eq("id", orderId)
    .single();

  const hasTse = !!(order as { tse_signature: string | null } | null)?.tse_signature;

  if (hasTse) {
    await enqueueOutboxEvents(admin, [
      {
        aggregate_id: orderId,
        domain: "fiscal",
        event_type: "fiscal.beleg",
        payload: { orderId, guestEmail },
      },
    ]);

    logger.info("Outbox fiscal.tse_sign processed", {
      orderId,
      signed: true,
      chainedBeleg: true,
    });
    return;
  }

  if (!isFiskalyConfigured()) {
    if (guestEmail) {
      await enqueueOutboxEvents(admin, [
        {
          aggregate_id: orderId,
          domain: "fiscal",
          event_type: "fiscal.send_receipt",
          payload: { orderId, guestEmail },
        },
      ]);
    }

    logger.info("Outbox fiscal.tse_sign processed", {
      orderId,
      signed: false,
      fiskalyConfigured: false,
    });
    return;
  }

  logger.warn("Outbox fiscal.tse_sign completed without TSE signature", {
    orderId,
  });
}
