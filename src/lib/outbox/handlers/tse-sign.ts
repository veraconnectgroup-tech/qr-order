import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import {
  signFiscalJournalStorno,
  signFiscalJournalTransaction,
} from "@/lib/fiscal/runtime/sign-journal-transaction";
import { signFiscalJournalZClosing } from "@/lib/fiscal/runtime/sign-journal-z-closing";
import { signOrderTransactionById } from "@/lib/fiscal/sign-transaction";
import { criticalPath } from "@/lib/orders/critical-path-events";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { logger } from "@/lib/logger";
import { TseSigningDeferredError } from "@/lib/resilience/circuit-breaker";
import { createAdminClient } from "@/lib/supabase/admin";

function parseGuestEmail(payload: Record<string, unknown>): string | null {
  return typeof payload.guestEmail === "string" && payload.guestEmail.trim()
    ? payload.guestEmail.trim()
    : null;
}

function parseOrderId(payload: Record<string, unknown>): string | null {
  return typeof payload.orderId === "string" && payload.orderId
    ? payload.orderId
    : null;
}

function parseFiscalTransactionId(payload: Record<string, unknown>): string | null {
  return typeof payload.fiscalTransactionId === "string" &&
    payload.fiscalTransactionId
    ? payload.fiscalTransactionId
    : null;
}

function parseClosingKind(payload: Record<string, unknown>): string | null {
  return typeof payload.closingKind === "string" ? payload.closingKind : null;
}

async function signJournalByType(
  admin: ReturnType<typeof createAdminClient>,
  fiscalTransactionId: string
): Promise<string | null> {
  const { data: tx } = await admin
    .from("fiscal_transactions")
    .select("tx_type, order_id")
    .eq("id", fiscalTransactionId)
    .maybeSingle();

  const row = tx as { tx_type: string; order_id: string | null } | null;
  if (!row) {
    await signFiscalJournalTransaction(fiscalTransactionId);
    return null;
  }

  switch (row.tx_type) {
    case "storno":
      await signFiscalJournalStorno(fiscalTransactionId);
      return row.order_id;
    case "z_closing":
      await signFiscalJournalZClosing(fiscalTransactionId);
      return null;
    default:
      await signFiscalJournalTransaction(fiscalTransactionId);
      return row.order_id;
  }
}

export async function handleFiscalTseSign(
  payload: Record<string, unknown>
): Promise<void> {
  const fiscalTransactionId = parseFiscalTransactionId(payload);
  const orderId = parseOrderId(payload);
  const guestEmail = parseGuestEmail(payload);

  if (!fiscalTransactionId && !orderId) {
    throw new Error("fiscal.tse_sign missing orderId or fiscalTransactionId");
  }

  const admin = createAdminClient();
  let resolvedOrderId = orderId;

  try {
    const tseStarted = Date.now();

    if (fiscalTransactionId) {
      const orderFromJournal = await signJournalByType(admin, fiscalTransactionId);
      resolvedOrderId = resolvedOrderId ?? orderFromJournal;

      if (!resolvedOrderId) {
        const { data: tx } = await admin
          .from("fiscal_transactions")
          .select("order_id, tx_type")
          .eq("id", fiscalTransactionId)
          .maybeSingle();
        const txRow = tx as { order_id: string | null; tx_type: string } | null;
        if (txRow?.tx_type === "z_closing") {
          logger.info("Outbox fiscal.tse_sign processed z_closing", {
            fiscalTransactionId,
            closingKind: parseClosingKind(payload),
          });
          return;
        }
        resolvedOrderId = txRow?.order_id ?? null;
      }
    } else if (orderId) {
      await signOrderTransactionById(orderId);
      resolvedOrderId = orderId;
    }

    const tseDuration = Date.now() - tseStarted;

    if (resolvedOrderId) {
      const { data: order } = await admin
        .from("orders")
        .select("tse_signature")
        .eq("id", resolvedOrderId)
        .single();

      const orderRow = order as { tse_signature: string | null } | null;

      if (orderRow?.tse_signature) {
        criticalPath.tseSigned({
          orderId: resolvedOrderId,
          duration_ms: tseDuration,
        });
      }
    }
  } catch (error) {
    if (error instanceof TseSigningDeferredError) {
      criticalPath.tseDeferred({
        orderId: resolvedOrderId ?? orderId ?? "unknown",
        reason: "fiskaly circuit open",
      });
      logger.warn("Outbox fiscal.tse_sign deferred — fiskaly circuit open", {
        orderId: resolvedOrderId,
        fiscalTransactionId,
      });
      throw error;
    }
    throw error;
  }

  if (!resolvedOrderId) {
    throw new Error("fiscal.tse_sign could not resolve orderId");
  }

  const { data: order } = await admin
    .from("orders")
    .select("tse_signature")
    .eq("id", resolvedOrderId)
    .single();

  const hasTse = !!(order as { tse_signature: string | null } | null)?.tse_signature;

  if (hasTse) {
    await enqueueOutboxEvents(admin, [
      {
        aggregate_id: resolvedOrderId,
        domain: "fiscal",
        event_type: "fiscal.beleg",
        payload: {
          orderId: resolvedOrderId,
          guestEmail,
          fiscalTransactionId,
        },
      },
    ]);

    logger.info("Outbox fiscal.tse_sign processed", {
      orderId: resolvedOrderId,
      fiscalTransactionId,
      signed: true,
      chainedBeleg: true,
    });
    return;
  }

  if (!isFiskalyConfigured()) {
    if (guestEmail) {
      await enqueueOutboxEvents(admin, [
        {
          aggregate_id: resolvedOrderId,
          domain: "fiscal",
          event_type: "fiscal.send_receipt",
          payload: { orderId: resolvedOrderId, guestEmail },
        },
      ]);
    }

    logger.info("Outbox fiscal.tse_sign processed", {
      orderId: resolvedOrderId,
      fiscalTransactionId,
      signed: false,
      fiskalyConfigured: false,
    });
    return;
  }

  logger.warn("Outbox fiscal.tse_sign completed without TSE signature", {
    orderId: resolvedOrderId,
    fiscalTransactionId,
  });
}
