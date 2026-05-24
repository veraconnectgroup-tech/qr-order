import { cancelPosInboundOrder } from "@/lib/pos/inbound/cancel-pos-order";
import { createPosOrder } from "@/lib/pos/inbound/create-pos-order";
import { resolvePosTableForClose } from "@/lib/pos/inbound/resolve-table";
import {
  hashInboundPayload,
  recordPosInboundEvent,
  touchPosIntegrationSync,
} from "@/lib/pos/inbound/audit";
import { getPosInboundAdapter } from "@/lib/pos/inbound/adapter-registry";
import type { InboundWebhookResult } from "@/lib/pos/inbound/types";
import type { PosProvider } from "@/lib/pos/pos-actions";
import { getActiveTableSession, closeTableSession } from "@/lib/sessions/session-devices";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type IntegrationRow = {
  id: string;
  location_id: string;
  provider: PosProvider;
  status: string;
  config: Json;
};

async function loadIntegration(
  integrationId: string
): Promise<IntegrationRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pos_integrations")
    .select("id, location_id, provider, status, config")
    .eq("id", integrationId)
    .maybeSingle();

  return (data as IntegrationRow | null) ?? null;
}

async function markSessionClosing(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
) {
  await admin
    .from("table_sessions")
    .update({ access_state: "closing" })
    .eq("id", sessionId)
    .eq("status", "active");
}

async function markSessionOrdersPaidAtPos(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
) {
  await admin
    .from("orders")
    .update({
      payment_status: "paid",
      payment_method: "pos",
    })
    .eq("session_id", sessionId)
    .neq("payment_status", "paid")
    .not("status", "in", '("cancelled","rejected")');
}

async function handleTableClosed(
  integration: IntegrationRow,
  event: Extract<
    Awaited<ReturnType<ReturnType<typeof getPosInboundAdapter>["parseEvent"]>>,
    { type: "table.closed" }
  >
): Promise<InboundWebhookResult> {
  const admin = createAdminClient();
  const config =
    integration.config && typeof integration.config === "object"
      ? (integration.config as Record<string, unknown>)
      : {};

  const tableResult = await resolvePosTableForClose({
    locationId: integration.location_id,
    provider: integration.provider,
    config,
    externalTableId: event.table.externalTableId,
    tableName: event.table.tableName,
  });

  if ("error" in tableResult) {
    return { ok: false, status: 422, message: tableResult.error };
  }

  const session = await getActiveTableSession(admin, tableResult.table.tableId);
  if (!session) {
    return {
      ok: true,
      status: 200,
      body: { message: "no_active_session", tableId: tableResult.table.tableId },
    };
  }

  await markSessionClosing(admin, session.id);

  if (event.table.settlement === "paid_at_pos") {
    await markSessionOrdersPaidAtPos(admin, session.id);
  }

  await closeTableSession(admin, session.id, "settled");

  await admin
    .from("table_sessions")
    .update({
      access_state: "closed",
      closed_by: "pos",
    })
    .eq("id", session.id);

  await touchPosIntegrationSync(admin, integration.id);

  logger.info("POS table closed", {
    integrationId: integration.id,
    tableId: tableResult.table.tableId,
    sessionId: session.id,
    settlement: event.table.settlement,
  });

  return {
    ok: true,
    status: 200,
    body: {
      message: "table_closed",
      sessionId: session.id,
      tableId: tableResult.table.tableId,
    },
  };
}

export async function handlePosInboundWebhook(
  integrationId: string,
  rawBody: string,
  headers: Headers
): Promise<InboundWebhookResult> {
  const started = Date.now();
  const payloadHash = hashInboundPayload(rawBody);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON" };
  }

  const integration = await loadIntegration(integrationId);
  if (!integration) {
    return { ok: false, status: 404, message: "Integration not found" };
  }

  if (integration.status !== "connected") {
    return { ok: false, status: 409, message: "Integration not connected" };
  }

  const config =
    integration.config && typeof integration.config === "object"
      ? (integration.config as Record<string, unknown>)
      : {};

  const adapter = getPosInboundAdapter(integration.provider);

  if (!adapter.verifyWebhookSignature(rawBody, headers, config)) {
    return { ok: false, status: 401, message: "Invalid signature" };
  }

  const event = adapter.parseEvent(parsed, headers);

  if (event.type === "reject") {
    await recordPosInboundEvent({
      posIntegrationId: integration.id,
      eventType: "reject",
      payloadHash,
      processingStatus: "rejected",
      httpStatus: 422,
      errorMessage: event.reason,
      durationMs: Date.now() - started,
    });
    return { ok: false, status: 422, message: event.reason };
  }

  await recordPosInboundEvent({
    posIntegrationId: integration.id,
    eventType: event.type,
    externalId:
      event.type === "order.created"
        ? event.order.externalOrderId
        : event.type === "order.cancelled"
          ? event.externalOrderId
          : event.table.externalTableId ?? event.table.tableName ?? null,
    payloadHash,
    processingStatus: "received",
  });

  if (event.type === "table.closed") {
    const result = await handleTableClosed(integration, event);
    await recordPosInboundEvent({
      posIntegrationId: integration.id,
      eventType: event.type,
      payloadHash,
      processingStatus: result.ok ? "processed" : "rejected",
      httpStatus: result.ok ? result.status : result.status,
      errorMessage: result.ok ? null : result.message,
      durationMs: Date.now() - started,
    });
    return result;
  }

  if (event.type === "order.cancelled") {
    const cancelResult = await cancelPosInboundOrder(
      integration.id,
      event.externalOrderId
    );

    await recordPosInboundEvent({
      posIntegrationId: integration.id,
      eventType: event.type,
      externalId: event.externalOrderId,
      payloadHash,
      processingStatus: cancelResult.ok ? "processed" : "rejected",
      httpStatus: cancelResult.ok ? 200 : cancelResult.status,
      errorMessage: cancelResult.ok ? null : cancelResult.message,
      orderId: cancelResult.ok && cancelResult.orderId ? cancelResult.orderId : null,
      durationMs: Date.now() - started,
    });

    if (!cancelResult.ok) {
      return {
        ok: false,
        status: cancelResult.status,
        message: cancelResult.message,
      };
    }

    return {
      ok: true,
      status: 200,
      body: {
        message: cancelResult.orderId
          ? cancelResult.alreadyCancelled
            ? "cancel_already_applied"
            : "order_cancelled"
          : "cancel_acknowledged",
        externalOrderId: event.externalOrderId,
        orderId: cancelResult.orderId || undefined,
        orderNumber: cancelResult.orderNumber || undefined,
      },
    };
  }

  const createResult = await createPosOrder(integrationId, event.order);

  await recordPosInboundEvent({
    posIntegrationId: integration.id,
    eventType: event.type,
    externalId: event.order.externalOrderId,
    payloadHash,
    processingStatus: createResult.ok
      ? createResult.alreadyExisted
        ? "duplicate"
        : "processed"
      : "rejected",
    httpStatus: createResult.ok ? 200 : createResult.status,
    errorMessage: createResult.ok ? null : createResult.message,
    orderId: createResult.ok ? createResult.orderId : null,
    sessionId: createResult.ok ? createResult.sessionId : null,
    durationMs: Date.now() - started,
  });

  if (!createResult.ok) {
    return { ok: false, status: createResult.status, message: createResult.message };
  }

  return {
    ok: true,
    status: createResult.alreadyExisted ? 200 : 201,
    body: {
      orderId: createResult.orderId,
      orderNumber: createResult.orderNumber,
      sessionId: createResult.sessionId,
      total: createResult.total,
      tableName: createResult.tableName,
      alreadyExisted: createResult.alreadyExisted,
    },
  };
}
