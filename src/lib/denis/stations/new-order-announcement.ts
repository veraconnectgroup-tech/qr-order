/**
 * ADR-053 M6 — pure formatter for reading a new bon aloud at a station.
 * No I/O: the caller (denis-question-strip.tsx) resolves which items
 * belong to this station and passes plain names/quantities in.
 */

export type AnnouncementItem = {
  productName: string;
  quantity: number;
};

/** Groups repeated items so two separate "jedan ćevap" lines become "dva ćevapa". */
export function mergeAnnouncementItems(
  items: AnnouncementItem[]
): AnnouncementItem[] {
  const byName = new Map<string, number>();
  const order: string[] = [];
  for (const item of items) {
    const name = item.productName.trim();
    if (!name) continue;
    if (!byName.has(name)) order.push(name);
    byName.set(name, (byName.get(name) ?? 0) + item.quantity);
  }
  return order.map((name) => ({ productName: name, quantity: byName.get(name)! }));
}

function formatItemLine(item: AnnouncementItem): string {
  return item.quantity > 1
    ? `${item.quantity}x ${item.productName}`
    : item.productName;
}

export function buildNewOrderAnnouncement(input: {
  tableName: string;
  orderNumber: number | null;
  items: AnnouncementItem[];
}): string | null {
  const merged = mergeAnnouncementItems(input.items);
  if (merged.length === 0) return null;

  const bon = input.orderNumber != null ? `Bon #${input.orderNumber}` : "Novi bon";
  const itemsText = merged.map(formatItemLine).join(", ");
  return `${bon}, sto ${input.tableName}: ${itemsText}.`;
}
