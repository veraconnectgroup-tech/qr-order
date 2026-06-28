import { formatOrderNumber, formatPrice } from "@/lib/format";
import { escapeHtml } from "@/lib/security/escape";

type ReceiptItem = {
  product_name: string;
  quantity: number;
  total: number;
  notes: string | null;
  modifiers: Array<{ modifier_name: string; price: number }>;
};

type ReceiptData = {
  orgName: string;
  locationName: string;
  tableName: string | null;
  orderNumber: number;
  createdAt: string;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  currency: string;
  paymentStatus: string;
  items: ReceiptItem[];
  orderUrl?: string;
  logoUrl?: string | null;
  accentColor?: string;
  footerMessage?: string;
  poweredByLabel?: string;
  hidePoweredBy?: boolean;
};

export function buildOrderReceiptHtml(data: ReceiptData) {
  const paid = data.paymentStatus === "paid";
  const accent = data.accentColor ?? "#f97316";
  const date = new Date(data.createdAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows = data.items
    .map((item) => {
      const mods = item.modifiers.length
        ? `<div style="color:#71717a;font-size:13px;margin-top:2px">${item.modifiers
            .map((m) => escapeHtml(m.modifier_name))
            .join(", ")}</div>`
        : "";
      const notes = item.notes
        ? `<div style="color:#71717a;font-size:13px;margin-top:2px">${escapeHtml(item.notes)}</div>`
        : "";

      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #27272a;color:#fafafa">
            <strong>${item.quantity}× ${escapeHtml(item.product_name)}</strong>
            ${mods}${notes}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #27272a;text-align:right;color:#fafafa;white-space:nowrap">
            ${formatPrice(item.total, data.currency)}
          </td>
        </tr>`;
    })
    .join("");

  const trackLink = data.orderUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(data.orderUrl)}" style="color:${escapeHtml(accent)};text-decoration:none">Track your order →</a></p>`
    : "";

  const logoBlock = data.logoUrl
    ? `<img src="${escapeHtml(data.logoUrl)}" alt="" width="48" height="48" style="border-radius:8px;margin-bottom:12px" />`
    : "";

  const poweredBy = data.hidePoweredBy
    ? ""
    : `<p style="margin:32px 0 0;font-size:12px;color:#52525b;text-align:center">${escapeHtml(data.footerMessage ?? "Thank you for your order")}${data.poweredByLabel ? ` · ${escapeHtml(data.poweredByLabel)}` : ""}</p>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#09090b;font-family:Inter,system-ui,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    ${logoBlock}
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a">Receipt</p>
    <h1 style="margin:0 0 8px;font-size:24px;color:#fafafa">${escapeHtml(data.orgName)}</h1>
    <p style="margin:0 0 24px;color:#a1a1aa;font-size:14px">${escapeHtml(data.locationName)}${data.tableName ? ` · ${escapeHtml(data.tableName)}` : ""}</p>

    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <span style="color:#a1a1aa;font-size:14px">${escapeHtml(formatOrderNumber(data.orderNumber))}</span>
        <span style="color:#a1a1aa;font-size:14px">${escapeHtml(date)}</span>
      </div>

      <table style="width:100%;border-collapse:collapse">${rows}</table>

      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #27272a;font-size:14px;color:#a1a1aa">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span>Subtotal</span><span>${formatPrice(data.subtotal, data.currency)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span>Tax (${escapeHtml(String(data.taxPercent))}%)</span><span>${formatPrice(data.taxAmount, data.currency)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;color:#fafafa;margin-top:8px">
          <span>Total</span><span>${formatPrice(data.total, data.currency)}</span>
        </div>
      </div>

      <p style="margin:16px 0 0;font-size:13px;color:${paid ? "#4ade80" : "#fbbf24"}">
        ${paid ? "Paid via Stripe" : "Pay at the table"}
      </p>
    </div>

    ${trackLink}

    ${poweredBy}
  </div>
</body>
</html>`;
}
