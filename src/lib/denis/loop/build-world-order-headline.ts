import type { MenuLocale } from "@/lib/i18n/translations";

export type WorldOrderSnapshot = {
  id: string;
  orderNumber: number | null;
  status: string;
  items: Array<{ productName: string; quantity: number }>;
};

type HeadlineLang = "sr" | "de" | "en";

const TERMINAL_STATUSES = ["delivered", "cancelled", "rejected"] as const;
const PREPARING_STATUSES = [
  "preparing",
  "accepted",
  "pending",
  "pending_approval",
] as const;

function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

function isPreparingStatus(status: string): boolean {
  return (PREPARING_STATUSES as readonly string[]).includes(status);
}

function resolveHeadlineLang(
  menuLocale: MenuLocale,
  isEnglish?: boolean
): HeadlineLang {
  if (isEnglish) return "en";
  if (menuLocale === "de") return "de";
  return "sr";
}

export function formatWorldOrderItems(
  items: WorldOrderSnapshot["items"]
): string {
  if (!items.length) return "";
  return items
    .map((item) => {
      const qty = item.quantity > 1 ? `${item.quantity}× ` : "";
      return `${qty}${item.productName}`;
    })
    .join(" + ");
}

function orderItemsLabel(order: WorldOrderSnapshot): string {
  const label = formatWorldOrderItems(order.items);
  if (label) return label;
  if (order.orderNumber != null && order.orderNumber > 0) {
    return `#${order.orderNumber}`;
  }
  return "";
}

function deliveredClosingMessage(lang: HeadlineLang): string {
  if (lang === "de") {
    return "Guten Appetit! Kann ich sonst noch etwas für Sie tun?";
  }
  if (lang === "en") {
    return "Enjoy! Can I get you anything else?";
  }
  return "Prijatno! Trebate li još nešto?";
}

function preparingSingleMessage(lang: HeadlineLang, items: string): string {
  if (lang === "de") return `${items} werden zubereitet.`;
  if (lang === "en") return `${items} are being prepared.`;
  return `${items} se pripremaju.`;
}

function readySingleMessage(lang: HeadlineLang, items: string): string {
  if (lang === "de") return `🔔 ${items} ${items.includes("+") ? "sind" : "ist"} fertig!`;
  if (lang === "en") return `🔔 ${items} ${items.includes("+") ? "are" : "is"} ready!`;
  return `🔔 ${items} su spremni!`;
}

function mixedReadyPreparingMessage(
  lang: HeadlineLang,
  readyLabel: string,
  preparingLabel: string
): string {
  if (lang === "de") {
    return `🔔 ${readyLabel} fertig, ${preparingLabel} wird noch zubereitet.`;
  }
  if (lang === "en") {
    return `🔔 ${readyLabel} ready, ${preparingLabel} still preparing.`;
  }
  return `🔔 ${readyLabel} spreman, ${preparingLabel} se još priprema.`;
}

function joinOrderLabels(orders: WorldOrderSnapshot[]): string {
  return orders
    .map(orderItemsLabel)
    .filter((label) => label.length > 0)
    .join(", ");
}

/** Composite guest headline from live session orders (B2 — item names, multi-order). */
export function buildWorldOrderHeadline(input: {
  orders: WorldOrderSnapshot[];
  menuLocale: MenuLocale;
  isEnglish?: boolean;
}): string {
  const lang = resolveHeadlineLang(input.menuLocale, input.isEnglish);
  const open = input.orders.filter((order) => !isTerminalStatus(order.status));

  if (!open.length) {
    return deliveredClosingMessage(lang);
  }

  const ready = open.filter((order) => order.status === "ready");
  const preparing = open.filter((order) => isPreparingStatus(order.status));

  if (ready.length && preparing.length) {
    return mixedReadyPreparingMessage(
      lang,
      joinOrderLabels(ready),
      joinOrderLabels(preparing)
    );
  }

  if (ready.length) {
    if (ready.length === 1) {
      return readySingleMessage(lang, orderItemsLabel(ready[0]!));
    }
    return readySingleMessage(lang, joinOrderLabels(ready));
  }

  if (preparing.length) {
    if (preparing.length === 1) {
      return preparingSingleMessage(lang, orderItemsLabel(preparing[0]!));
    }
    return preparingSingleMessage(lang, joinOrderLabels(preparing));
  }

  const fallback = orderItemsLabel(open[0]!);
  return fallback || deliveredClosingMessage(lang);
}
