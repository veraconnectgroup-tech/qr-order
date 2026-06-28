import { randomUUID } from "crypto";
import { loadBelegData, type BelegData } from "@/lib/fiscal/beleg";
import { persistBelegArtifact } from "@/lib/fiscal/runtime/persist-fiscal-artifact";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { logger } from "@/lib/logger";
import { toJson } from "@/lib/supabase/json";
import type { Json } from "@/types/database";

function parseBelegSnapshot(raw: Json | null): BelegData | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as BelegData;
}

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
    .select("tse_signature, beleg_token, beleg_snapshot")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error(`fiscal.beleg order not found: ${orderId}`);
  }

  const existing = order as {
    tse_signature: string | null;
    beleg_token: string | null;
    beleg_snapshot: Json | null;
  };

  if (!existing.tse_signature) {
    throw new Error("fiscal.beleg requires TSE signature");
  }

  const needsToken = !existing.beleg_token;
  const needsSnapshot = !existing.beleg_snapshot;

  const fiscalTransactionId =
    typeof payload.fiscalTransactionId === "string" &&
    payload.fiscalTransactionId
      ? payload.fiscalTransactionId
      : null;

  let belegToken = existing.beleg_token;
  let snapshotForArtifact = parseBelegSnapshot(existing.beleg_snapshot);

  if (needsToken || needsSnapshot) {
    const update: {
      beleg_token?: string;
      beleg_snapshot?: Json;
    } = {};

    if (needsToken) {
      update.beleg_token = randomUUID();
      belegToken = update.beleg_token;
    }

    if (needsSnapshot) {
      const snapshot = await loadBelegData(admin, orderId);
      if (snapshot) {
        update.beleg_snapshot = toJson(snapshot);
        snapshotForArtifact = snapshot;
      }
    }

    if (Object.keys(update).length > 0) {
      const { error: updateError } = await admin
        .from("orders")
        .update(update as never)
        .eq("id", orderId);

      if (updateError) {
        throw new Error(
          `fiscal.beleg save failed: ${updateError.message}`
        );
      }

      if (needsToken) {
        logger.info("Outbox fiscal.beleg issued beleg_token", { orderId });
      }
      if (needsSnapshot && update.beleg_snapshot) {
        logger.info("Outbox fiscal.beleg saved beleg_snapshot", { orderId });
      }
    }
  }

  if (snapshotForArtifact) {
    await persistBelegArtifact(admin, {
      orderId,
      fiscalTransactionId,
      snapshot: snapshotForArtifact,
      publicToken: belegToken,
    });
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
