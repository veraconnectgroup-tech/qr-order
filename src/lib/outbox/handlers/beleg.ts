import { randomUUID } from "crypto";
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
    .select("tse_signature, beleg_token")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error(`fiscal.beleg order not found: ${orderId}`);
  }

  const existing = order as {
    tse_signature: string | null;
    beleg_token: string | null;
  };

  if (!existing.tse_signature) {
    throw new Error("fiscal.beleg requires TSE signature");
  }

  if (!existing.beleg_token) {
    const belegToken = randomUUID();
    const { error: tokenError } = await admin
      .from("orders")
      .update({ beleg_token: belegToken } as never)
      .eq("id", orderId);

    if (tokenError) {
      throw new Error(`fiscal.beleg beleg_token save failed: ${tokenError.message}`);
    }

    logger.info("Outbox fiscal.beleg issued beleg_token", { orderId });
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
