import type { DenisCartDraft, DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { OrderFact } from "@/lib/denis/loop/types";
import type { PosInboundOrderDraft } from "@/lib/pos/inbound/types";

function joinItemNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} i ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} i ${names[names.length - 1]}`;
}

/** Timeline narration: "Konobar dodao Pilsner na sto 7". */
export function buildPosInboundTimelineMessage(input: {
  tableName: string;
  items: Array<{ name: string; quantity: number }>;
  language?: string;
}): string {
  const lang = input.language?.trim().toLowerCase().slice(0, 2) ?? "sr";
  const table = input.tableName.trim() || "stolu";
  const labels = input.items
    .map((item) => {
      const name = item.name.trim();
      if (!name) return null;
      return item.quantity > 1 ? `${item.quantity}× ${name}` : name;
    })
    .filter(Boolean) as string[];

  const itemsLabel = joinItemNames(labels);

  if (lang === "de") {
    return `Kellner hat ${itemsLabel} an ${table} hinzugefügt`;
  }
  if (lang === "en") {
    return `Waiter added ${itemsLabel} to ${table}`;
  }
  return `Konobar dodao ${itemsLabel} na ${table}`;
}

export function posInboundDraftToCartLines(
  draft: PosInboundOrderDraft
): DenisCartLine[] {
  return draft.items.map((item) => ({
    productId: `pos:${item.name.trim().toLowerCase().replace(/\s+/g, "-")}`,
    productName: item.name.trim(),
    quantity: item.quantity,
    serveSize: null,
    modifierIds: [],
    notes: item.notes?.trim() ?? "",
    lineTotal: Number(item.total),
    menuSection: "food",
  }));
}

export function posInboundDraftToPeerManual(
  draft: PosInboundOrderDraft
): DenisCartDraft {
  return {
    cartRevision: 0,
    items: posInboundDraftToCartLines(draft),
  };
}

/** Build peer manual lines from committed POS-origin session orders. */
export function buildPosPeerManualFromOrders(
  orders: OrderFact[]
): DenisCartDraft {
  const lines: DenisCartLine[] = [];

  for (const order of orders) {
    if (order.orderSource && order.orderSource !== "pos") continue;
    for (const item of order.items) {
      lines.push({
        productId: item.productId ?? `pos:${item.productName}`,
        productName: item.productName,
        quantity: item.quantity,
        serveSize: null,
        modifierIds: [],
        notes: "",
        lineTotal: (item.lineTotalCents ?? 0) / 100,
        menuSection: (item.menuSection as DenisCartLine["menuSection"]) ?? "food",
      });
    }
  }

  return { cartRevision: 0, items: lines };
}
