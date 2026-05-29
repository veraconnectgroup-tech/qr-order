import { formatOrderNumber } from "@/lib/format";
import { getKitchenOrderItems } from "@/lib/kitchen/menu-section";
import { groupOrderItemsForDisplay } from "@/lib/orders/group-order-items-for-display";
import type { OrderWithDetails } from "@/types";

export function buildKitchenTicketHtml(
  order: OrderWithDetails,
  orgName: string
) {
  const tableName = order.tables?.name ?? "—";
  const items = groupOrderItemsForDisplay(getKitchenOrderItems(order));
  const time = new Date(order.created_at).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemRows = items
    .map((item) => {
      const mods =
        item.modifiers
          ?.map((m) => `<div class="mod">→ ${m.modifier_name}</div>`)
          .join("") ?? "";
      const notes = item.notes
        ? `<div class="mod note">→ ${item.notes}</div>`
        : "";
      return `<div class="item">
        <div class="qty">${item.quantity}×</div>
        <div class="name">${item.product_name}${mods}${notes}</div>
      </div>`;
    })
    .join("");

  const orderNotes = order.notes
    ? `<p class="order-note">${order.notes}</p>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Kitchen ${formatOrderNumber(order.order_number)}</title>
<style>
  @page { margin: 8mm; }
  body { font-family: ui-monospace, monospace; font-size: 14px; max-width: 80mm; margin: 0 auto; color: #000; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .meta { font-size: 12px; margin-bottom: 12px; }
  .item { display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start; }
  .qty { font-weight: bold; font-size: 18px; min-width: 36px; }
  .name { font-size: 16px; font-weight: 600; }
  .mod { font-size: 12px; font-weight: normal; margin-top: 2px; color: #333; }
  .note { font-style: italic; }
  .order-note { border-left: 3px solid #000; padding-left: 8px; margin-top: 12px; font-style: italic; }
  hr { border: none; border-top: 2px dashed #000; margin: 12px 0; }
</style></head><body>
<h1>${formatOrderNumber(order.order_number)}</h1>
<div class="meta">${orgName} · Table ${tableName} · ${time}</div>
<hr />
${itemRows}
${orderNotes}
<script>window.onload = () => { window.print(); }</script>
</body></html>`;
}

export function printKitchenTicket(order: OrderWithDetails, orgName: string) {
  const html = buildKitchenTicketHtml(order, orgName);
  const win = window.open("", "_blank", "noopener,noreferrer,width=360,height=640");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
