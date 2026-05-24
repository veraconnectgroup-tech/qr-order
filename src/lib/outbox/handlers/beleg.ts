import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { logger } from "@/lib/logger";

export async function handleFiscalBeleg(
  payload: Record<string, unknown>
): Promise<void> {
  const orderId = payload.orderId;
  if (typeof orderId !== "string" || !orderId) {
    throw new Error("fiscal.beleg missing orderId");
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("tse_signature")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error(`fiscal.beleg order not found: ${orderId}`);
  }

  const tseSignature = (order as { tse_signature: string | null }).tse_signature;
  if (!tseSignature) {
    throw new Error("fiscal.beleg requires TSE signature");
  }

  const guestEmail =
    typeof payload.guestEmail === "string" && payload.guestEmail.trim()
      ? payload.guestEmail.trim()
      : null;

  logger.info("Outbox fiscal.beleg processed", { orderId, hasGuestEmail: !!guestEmail });

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
}
