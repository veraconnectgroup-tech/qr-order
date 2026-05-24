import type {
  PosInboundAdapter,
  PosInboundEvent,
  PosInboundOrderDraft,
  PosInboundOrderItem,
} from "@/lib/pos/inbound/types";
import {
  verifyPosWebhookSignature,
  webhookSecretFromConfig,
} from "@/lib/pos/inbound/verify-signature";

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseItems(raw: unknown): PosInboundOrderItem[] {
  if (!Array.isArray(raw)) return [];

  const items: PosInboundOrderItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = readString(row.name ?? row.product_name ?? row.productName);
    const quantity = readNumber(row.quantity) ?? 1;
    const unitPrice =
      readNumber(row.unitPrice ?? row.unit_price ?? row.price) ?? 0;
    const total =
      readNumber(row.total ?? row.lineTotal ?? row.line_total) ??
      unitPrice * quantity;

    if (!name) continue;

    const modifiers = Array.isArray(row.modifiers)
      ? row.modifiers
          .map((mod) => {
            if (!mod || typeof mod !== "object") return null;
            const m = mod as Record<string, unknown>;
            const modName = readString(m.name ?? m.modifier_name);
            if (!modName) return null;
            return {
              name: modName,
              price: readNumber(m.price) ?? 0,
            };
          })
          .filter((m): m is { name: string; price: number } => m !== null)
      : [];

    items.push({
      name,
      quantity: Math.max(1, Math.floor(quantity)),
      unitPrice,
      total,
      notes: readString(row.notes ?? row.remark),
      taxRate: readNumber(row.taxRate ?? row.tax_rate) ?? undefined,
      modifiers,
    });
  }

  return items;
}

type InferredEventType =
  | PosInboundEvent["type"]
  | "unknown";

function inferEventType(body: Record<string, unknown>): InferredEventType {
  const explicit = readString(body.event ?? body.eventType ?? body.type);
  if (explicit === "order.created" || explicit === "order_created") {
    return "order.created";
  }
  if (explicit === "order.cancelled" || explicit === "order_cancelled") {
    return "order.cancelled";
  }
  if (explicit === "table.closed" || explicit === "table_closed") {
    return "table.closed";
  }

  if (body.settlement !== undefined || body.externalTableId !== undefined) {
    return "table.closed";
  }

  const nestedOrder =
    body.order && typeof body.order === "object"
      ? (body.order as Record<string, unknown>)
      : null;
  const cancelId = readString(
    body.externalOrderId ??
      body.external_order_id ??
      body.channelOrderId ??
      body.orderId ??
      nestedOrder?.externalOrderId ??
      nestedOrder?.id
  );
  const hasCancelHint =
    explicit === "cancel" ||
    explicit === "cancelled" ||
    body.cancelled === true ||
    body.canceled === true;

  if (hasCancelHint && cancelId) {
    return "order.cancelled";
  }

  if (body.items !== undefined || body.order !== undefined) {
    return "order.created";
  }

  return "unknown";
}

function parseOrderDraft(body: Record<string, unknown>): PosInboundOrderDraft {
  const nested =
    body.order && typeof body.order === "object"
      ? (body.order as Record<string, unknown>)
      : body;

  const externalOrderId =
    readString(
      nested.externalOrderId ??
        nested.external_order_id ??
        nested.channelOrderId ??
        nested.orderId ??
        nested.id
    ) ?? "";

  const items = parseItems(nested.items ?? nested.products ?? nested.lineItems);
  const subtotal =
    readNumber(nested.subtotal) ??
    items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = readNumber(nested.taxAmount ?? nested.tax_amount) ?? 0;
  const total =
    readNumber(nested.total ?? nested.amount) ?? subtotal + taxAmount;
  const taxPercent =
    readNumber(nested.taxPercent ?? nested.tax_percent) ??
    (subtotal > 0 ? (taxAmount / subtotal) * 100 : 19);

  const paymentRaw = readString(
    nested.paymentState ?? nested.payment_state ?? nested.paymentStatus
  );
  const paymentState =
    paymentRaw?.toLowerCase() === "paid" ||
    nested.orderIsAlreadyPaid === true ||
    nested.paid === true
      ? "PAID"
      : "UNPAID";

  return {
    externalOrderId,
    externalLocationId: readString(
      nested.externalLocationId ?? nested.external_location_id ?? nested.locationId
    ),
    tableName: readString(
      nested.tableName ?? nested.table_name ?? nested.table ?? nested.tableNumber
    ),
    externalTableId: readString(
      nested.externalTableId ?? nested.external_table_id ?? nested.tableId
    ),
    items,
    subtotal,
    taxPercent,
    taxAmount,
    total,
    currency: readString(nested.currency) ?? "EUR",
    paymentState,
    notes: readString(nested.notes ?? nested.remark),
    createdAt: readString(nested.createdAt ?? nested.created_at) ?? undefined,
    status:
      readString(nested.status)?.toLowerCase() === "preparing"
        ? "preparing"
        : "accepted",
  };
}

export class GenericInboundAdapter implements PosInboundAdapter {
  provider = "generic";

  verifyWebhookSignature(
    rawBody: string,
    headers: Headers,
    config: Record<string, unknown>
  ): boolean {
    const secret = webhookSecretFromConfig(config);
    if (!secret) return false;
    return verifyPosWebhookSignature(rawBody, headers, secret);
  }

  parseEvent(
    rawBody: Record<string, unknown>,
    _headers?: Headers
  ): PosInboundEvent {
    const eventType = inferEventType(rawBody);

    if (eventType === "unknown") {
      return {
        type: "unknown",
        rawEventType:
          readString(rawBody.event ?? rawBody.eventType ?? rawBody.type) ??
          undefined,
      };
    }

    if (eventType === "table.closed") {
      const nested =
        rawBody.table && typeof rawBody.table === "object"
          ? (rawBody.table as Record<string, unknown>)
          : rawBody;
      const settlementRaw = readString(
        nested.settlement ?? nested.paymentSettlement
      );
      return {
        type: "table.closed",
        table: {
          externalTableId: readString(
            nested.externalTableId ?? nested.external_table_id
          ),
          tableName: readString(nested.tableName ?? nested.table_name),
          settlement:
            settlementRaw === "paid_at_pos" ? "paid_at_pos" : "unpaid",
          externalSessionId: readString(
            nested.externalSessionId ?? nested.external_session_id
          ),
        },
      };
    }

    if (eventType === "order.cancelled") {
      const externalOrderId =
        readString(
          rawBody.externalOrderId ??
            rawBody.external_order_id ??
            rawBody.channelOrderId ??
            rawBody.orderId
        ) ?? "";
      if (!externalOrderId) {
        return {
          type: "reject",
          reason: "order.cancelled requires externalOrderId",
        };
      }
      return { type: "order.cancelled", externalOrderId };
    }

    const order = parseOrderDraft(rawBody);
    if (!order.externalOrderId) {
      return { type: "reject", reason: "order.created requires externalOrderId" };
    }
    if (!order.items.length) {
      return { type: "reject", reason: "order.created requires at least one item" };
    }

    return { type: "order.created", order };
  }
}
