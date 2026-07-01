/** W2 — Denis ↔ POS/fiscal bridge (optional, async, non-blocking). */

export type PosProvider = "generic_webhook" | "esir" | "galeb" | "custom";

export type PosBridgeOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  category: string;
};

export type PosOrderPayload = {
  externalOrderId: string;
  items: PosBridgeOrderItem[];
  total: number;
  tableIdentifier: string;
  paymentMethod: "cash" | "card" | "online";
  fiscalNote: string | null;
};

export type PosBridgeConfig = {
  provider: PosProvider;
  endpoint: string;
  apiKey: string;
  autoSync: boolean;
  taxRate: number;
};

export type PosBridgeResult = {
  success: boolean;
  fiscalReceipt: string | null;
  error?: string;
};

function buildProviderPayload(
  provider: PosProvider,
  order: PosOrderPayload
): Record<string, unknown> {
  const base = {
    externalOrderId: order.externalOrderId,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      category: item.category,
      lineTotal: Math.round(item.unitPrice * item.quantity),
    })),
    total: order.total,
    tableIdentifier: order.tableIdentifier,
    paymentMethod: order.paymentMethod,
    fiscalNote: order.fiscalNote,
    timestamp: new Date().toISOString(),
  };

  if (provider === "esir") {
    return { ...base, format: "esir_v1" };
  }
  if (provider === "galeb") {
    return { ...base, format: "galeb_v1" };
  }
  return base;
}

function providerHeaders(
  provider: PosProvider,
  apiKey: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === "esir") {
    headers["X-ESIR-Version"] = "1.0";
  }
  if (provider === "galeb") {
    headers["X-Galeb-Integration"] = "denis";
  }
  return headers;
}

/** Send order to external POS/fiscal system. Non-blocking — caller handles retry queue. */
export async function sendOrderToPos(
  config: PosBridgeConfig,
  order: PosOrderPayload
): Promise<PosBridgeResult> {
  if (!config.endpoint || !config.autoSync) {
    return { success: false, fiscalReceipt: null, error: "POS bridge disabled" };
  }

  const body = JSON.stringify(buildProviderPayload(config.provider, order));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(config.endpoint, {
      method: "POST",
      headers: providerHeaders(config.provider, config.apiKey),
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        success: false,
        fiscalReceipt: null,
        error: `POS HTTP ${res.status}`,
      };
    }

    let fiscalReceipt: string | null = null;
    try {
      const json = (await res.json()) as Record<string, unknown>;
      fiscalReceipt =
        typeof json.fiscalReceipt === "string"
          ? json.fiscalReceipt
          : typeof json.receiptNumber === "string"
            ? json.receiptNumber
            : null;
    } catch {
      fiscalReceipt = null;
    }

    return { success: true, fiscalReceipt };
  } catch (error) {
    return {
      success: false,
      fiscalReceipt: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Compute tax-inclusive line totals for POS payload. */
export function buildPosBridgeItems(
  items: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
    taxRate?: number;
    category?: string;
  }>,
  defaultTaxRate: number
): PosBridgeOrderItem[] {
  return items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPriceCents,
    taxRate: item.taxRate ?? defaultTaxRate,
    category: item.category ?? "general",
  }));
}

export function computePosBridgeTotal(items: PosBridgeOrderItem[]): number {
  return items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * item.quantity),
    0
  );
}

export type PosBridgeQueueEntry = {
  orderId: string;
  tableName: string;
  queuedAt: string;
};

/** Format staff alert when POS is offline with pending orders. */
export function formatPosOfflineAlert(pending: PosBridgeQueueEntry[]): string {
  const count = pending.length;
  if (count === 0) return "";
  return `POS nedostupan — ${count} narudžb${count === 1 ? "a" : "e"} čekaju fiskalizaciju`;
}
