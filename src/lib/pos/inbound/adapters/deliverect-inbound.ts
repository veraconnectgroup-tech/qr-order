import { GenericInboundAdapter } from "@/lib/pos/inbound/adapters/generic-inbound";
import type {
  PosInboundEvent,
  PosInboundOrderItem,
} from "@/lib/pos/inbound/types";
import {
  verifyPosWebhookSignature,
  webhookSecretFromConfig,
} from "@/lib/pos/inbound/verify-signature";
import { isUuid } from "@/lib/security/sanitize";

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

function centsToDecimal(value: unknown): number | null {
  const raw = readNumber(value);
  if (raw === null) return null;
  if (Number.isInteger(raw) && Math.abs(raw) >= 100) {
    return raw / 100;
  }
  return raw;
}

function parseDeliverectItems(raw: unknown): PosInboundOrderItem[] {
  if (!Array.isArray(raw)) return [];

  const items: PosInboundOrderItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = readString(row.name ?? row.product_name ?? row.productName);
    const quantity = readNumber(row.quantity) ?? 1;
    const unitPrice =
      centsToDecimal(row.unitPrice ?? row.unit_price ?? row.price) ?? 0;
    const total =
      centsToDecimal(row.total ?? row.lineTotal ?? row.line_total) ??
      unitPrice * quantity;

    if (!name) continue;

    const subItems = Array.isArray(row.subItems) ? row.subItems : row.modifiers;
    const modifiers = Array.isArray(subItems)
      ? subItems
          .map((mod) => {
            if (!mod || typeof mod !== "object") return null;
            const m = mod as Record<string, unknown>;
            const modName = readString(m.name ?? m.modifier_name);
            if (!modName) return null;
            return {
              name: modName,
              price: centsToDecimal(m.price) ?? 0,
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
      modifiers,
    });
  }

  return items;
}

/**
 * Deliverect inbound uses the generic normalizer with Deliverect-specific
 * field mapping (cents, subItems, _id). Status-only outbound echo webhooks
 * remain on the legacy deliverect-webhook handler via the inbound route.
 */
export class DeliverectInboundAdapter extends GenericInboundAdapter {
  provider = "deliverect";

  override verifyWebhookSignature(
    rawBody: string,
    headers: Headers,
    config: Record<string, unknown>
  ): boolean {
    const secret =
      webhookSecretFromConfig(config) ??
      (typeof process.env.DELIVERECT_WEBHOOK_SECRET === "string"
        ? process.env.DELIVERECT_WEBHOOK_SECRET.trim()
        : null);

    if (!secret) return false;
    return verifyPosWebhookSignature(rawBody, headers, secret);
  }

  override parseEvent(
    rawBody: Record<string, unknown>,
    headers?: Headers
  ): PosInboundEvent {
    return super.parseEvent(this.normalizeDeliverectPayload(rawBody), headers);
  }

  private normalizeDeliverectPayload(
    body: Record<string, unknown>
  ): Record<string, unknown> {
    const channelOrderId = readString(body.channelOrderId);
    const deliverectId = readString(body._id ?? body.orderId ?? body.id);

    const externalOrderId =
      deliverectId ??
      (channelOrderId && !isUuid(channelOrderId) ? channelOrderId : null) ??
      channelOrderId ??
      "";

    const items = parseDeliverectItems(body.items ?? body.products);
    const payment =
      body.payment && typeof body.payment === "object"
        ? (body.payment as Record<string, unknown>)
        : null;
    const paymentAmount = payment ? centsToDecimal(payment.amount) : null;
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const total = paymentAmount ?? readNumber(body.total) ?? subtotal;

    const tableRaw =
      body.table && typeof body.table === "object"
        ? (body.table as Record<string, unknown>)
        : null;

    const tableName =
      readString(
        tableRaw?.name ??
          tableRaw?.tableName ??
          body.tableName ??
          body.tableNumber ??
          body.table_number
      ) ?? undefined;

    const externalTableId =
      readString(
        tableRaw?.id ??
          tableRaw?.externalId ??
          body.externalTableId ??
          body.tableId
      ) ?? undefined;

    const orderIsAlreadyPaid =
      body.orderIsAlreadyPaid === true ||
      payment?.type === 1 ||
      payment?.type === "1";

    return {
      event: "order.created",
      externalOrderId,
      tableName,
      externalTableId,
      items,
      subtotal,
      total,
      taxAmount: readNumber(body.taxAmount ?? body.tax_amount) ?? 0,
      paymentState: orderIsAlreadyPaid ? "PAID" : "UNPAID",
      notes: readString(body.note ?? body.notes),
    };
  }
}
