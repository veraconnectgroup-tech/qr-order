import type { PosAdapter, PosDeliveryResult, PosOrderPayload } from "@/lib/pos/types";

const DELIVERECT_ORDERS_URL =
  "https://api.deliverect.com/integrations/v2/orders";

const REQUEST_TIMEOUT_MS = 10_000;

type DeliverectConfig = {
  api_key: string;
  channel_link_id: string;
};

function parseDeliverectConfig(
  config: Record<string, unknown>
): DeliverectConfig {
  const api_key =
    typeof config.api_key === "string" ? config.api_key.trim() : "";
  const channel_link_id =
    typeof config.channel_link_id === "string"
      ? config.channel_link_id.trim()
      : "";

  if (!api_key) {
    throw new Error("Deliverect config missing api_key");
  }
  if (!channel_link_id) {
    throw new Error("Deliverect config missing channel_link_id");
  }

  return { api_key, channel_link_id };
}

export class DeliverectAdapter implements PosAdapter {
  provider = "deliverect";

  async pushOrder(
    payload: PosOrderPayload,
    config: Record<string, unknown>
  ): Promise<PosDeliveryResult> {
    const { api_key, channel_link_id } = parseDeliverectConfig(config);
    const totalCents = Math.round(payload.total * 100);
    const isPaid = payload.paymentState === "PAID";

    const body = {
      channelLinkId: channel_link_id,
      channelOrderId: payload.orderId,
      channelOrderDisplayId: `#${String(payload.orderNumber).padStart(3, "0")}`,
      // This platform is dine-in only (QR at the table) — always eat-in,
      // never delivery/pickup. See docs.deliverect.com "Create Orders for
      // Eat-in With a Table Number" — table is a free-text note unless the
      // POS adapter returns real table IDs (not all do; see the Denis AI ×
      // Deliverect feasibility report, Scenario A/D).
      orderType: 3,
      table: payload.tableName,
      channel: 19,
      payment: {
        amount: totalCents,
        type: isPaid ? 1 : 0,
      },
      items: payload.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: Math.round(item.unitPrice * 100),
        remark: item.notes ?? "",
        subItems: item.modifiers.map((modifier) => ({
          name: modifier.name,
          price: Math.round(modifier.price * 100),
          quantity: 1,
        })),
      })),
      decimalDigits: 2,
      orderIsAlreadyPaid: isPaid,
    };

    const response = await fetch(DELIVERECT_ORDERS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Deliverect API error ${response.status}${errorText ? `: ${errorText.slice(0, 200)}` : ""}`
      );
    }

    const data = (await response.json()) as { _id?: string };
    return {
      success: true,
      externalId: typeof data._id === "string" ? data._id : undefined,
    };
  }
}
