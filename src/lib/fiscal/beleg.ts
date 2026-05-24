import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import {
  EscPosBuilder,
  formatAlignedLine,
  type PaperWidth,
  separatorLine,
  wrapText,
} from "@/lib/printer/escpos-builder";
import { escapeHtml } from "@/lib/security/escape";

export type BelegTseData = {
  tss_serial?: string;
  signature_counter?: number;
  signature?: string;
  qr_code_data?: string;
};

export type BelegItem = {
  product_name: string;
  quantity: number;
  total: number;
  tax_rate: number;
  notes: string | null;
  modifiers: Array<{ modifier_name: string; price: number }>;
};

export type BelegData = {
  orgName: string;
  locationName: string;
  locationAddress?: string | null;
  steuernummer?: string | null;
  ustIdNr?: string | null;
  tableName: string | null;
  orderNumber: number;
  createdAt: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  inPersonPaymentLocation?: "table" | "counter" | "bar";
  items: BelegItem[];
  tseSignature: string;
  tseData: BelegTseData;
  orderUrl?: string;
};

type VatGroup = {
  rate: number;
  gross: number;
  net: number;
  tax: number;
};

function formatBelegDateTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function groupByVatRate(items: BelegItem[]): VatGroup[] {
  const buckets = new Map<number, number>();

  for (const item of items) {
    const rate = Number(item.tax_rate ?? 19);
    buckets.set(rate, (buckets.get(rate) ?? 0) + Number(item.total));
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, gross]) => {
      const net = gross / (1 + rate / 100);
      return {
        rate,
        gross,
        net,
        tax: gross - net,
      };
    });
}

async function buildTseQrDataUrl(qrPayload: string | undefined): Promise<string | null> {
  const data = qrPayload?.trim();
  if (!data) return null;

  try {
    return await QRCode.toDataURL(data, { width: 180, margin: 1 });
  } catch {
    return null;
  }
}

export async function buildBelegHtml(data: BelegData): Promise<string> {
  const dateTime = formatBelegDateTime(data.createdAt);
  const vatGroups = groupByVatRate(data.items);
  const paymentLabel = paymentMethodLabel(
    data.paymentMethod,
    data.inPersonPaymentLocation ?? "table"
  );
  const paid = data.paymentStatus === "paid";
  const qrUrl = await buildTseQrDataUrl(data.tseData.qr_code_data);

  const itemRows = data.items
    .map((item) => {
      const mods = item.modifiers.length
        ? `<div style="color:#71717a;font-size:12px;margin-top:2px">${item.modifiers
            .map((m) => escapeHtml(m.modifier_name))
            .join(", ")}</div>`
        : "";
      const notes = item.notes
        ? `<div style="color:#71717a;font-size:12px;margin-top:2px">${escapeHtml(item.notes)}</div>`
        : "";

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fafafa;font-size:14px">
            <strong>${item.quantity}× ${escapeHtml(item.product_name)}</strong>
            <div style="color:#71717a;font-size:11px;margin-top:2px">MwSt ${escapeHtml(String(item.tax_rate))}%</div>
            ${mods}${notes}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #27272a;text-align:right;color:#fafafa;white-space:nowrap;font-size:14px">
            ${formatPrice(item.total, data.currency)}
          </td>
        </tr>`;
    })
    .join("");

  const vatRows = vatGroups
    .map(
      (group) => `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;color:#a1a1aa">
          <span>MwSt ${group.rate}% (Netto ${formatPrice(group.net, data.currency)})</span>
          <span>${formatPrice(group.tax, data.currency)}</span>
        </div>`
    )
    .join("");

  const tssSerial = data.tseData.tss_serial?.trim();
  const signatureCounter = data.tseData.signature_counter;
  const signaturePreview = data.tseSignature.slice(0, 24);

  const trackLink = data.orderUrl
    ? `<p style="margin:20px 0 0"><a href="${escapeHtml(data.orderUrl)}" style="color:#f97316;text-decoration:none">Bestellstatus ansehen →</a></p>`
    : "";

  const qrBlock = qrUrl
    ? `<div style="margin-top:16px;text-align:center">
        <img src="${qrUrl}" alt="TSE QR-Code" width="180" height="180" style="background:#fff;border-radius:8px;padding:8px" />
        <p style="margin:8px 0 0;font-size:11px;color:#71717a">QR-Code gemäß KassenSichV (V0)</p>
      </div>`
    : "";

  const fiscalIdBlock = data.steuernummer
    ? `<p style="margin:0 0 24px;color:#a1a1aa;font-size:13px">St.-Nr.: ${escapeHtml(data.steuernummer)}</p>`
    : data.ustIdNr
      ? `<p style="margin:0 0 24px;color:#a1a1aa;font-size:13px">USt-IdNr: ${escapeHtml(data.ustIdNr)}</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kassenbeleg — ${escapeHtml(data.orgName)}</title>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { background: #fff !important; }
      * { color: #000 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:Inter,system-ui,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a">Kassenbeleg</p>
    <h1 style="margin:0 0 8px;font-size:24px;color:#fafafa">${escapeHtml(data.orgName)}</h1>
    <p style="margin:0 0 4px;color:#a1a1aa;font-size:14px">${escapeHtml(data.locationName)}</p>
    ${
      data.locationAddress
        ? `<p style="margin:0 0 4px;color:#71717a;font-size:13px">${escapeHtml(data.locationAddress)}</p>`
        : ""
    }
    ${fiscalIdBlock || `<div style="margin-bottom:24px"></div>`}

    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;font-size:14px;color:#a1a1aa">
        <span>Bon-Nr. ${escapeHtml(formatOrderNumber(data.orderNumber))}</span>
        <span>${escapeHtml(dateTime)}</span>
      </div>
      ${
        data.tableName
          ? `<p style="margin:0 0 16px;font-size:13px;color:#a1a1aa">Tisch: ${escapeHtml(data.tableName)}</p>`
          : ""
      }

      <table style="width:100%;border-collapse:collapse">${itemRows}</table>

      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #27272a">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:14px;color:#a1a1aa">
          <span>Zwischensumme</span><span>${formatPrice(data.subtotal, data.currency)}</span>
        </div>
        ${vatRows}
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:18px;font-weight:700;color:#fafafa">
          <span>Gesamtbetrag</span><span>${formatPrice(data.total, data.currency)}</span>
        </div>
      </div>

      <p style="margin:16px 0 0;font-size:13px;color:${paid ? "#4ade80" : "#fbbf24"}">
        Zahlungsart: ${escapeHtml(paymentLabel)}${paid ? " · bezahlt" : " · offen"}
      </p>

      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #27272a">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#4ade80;text-transform:uppercase;letter-spacing:0.06em">
          TSE-signiert (KassenSichV)
        </p>
        ${
          tssSerial
            ? `<p style="margin:0 0 4px;font-size:12px;color:#a1a1aa">TSE-Seriennummer: ${escapeHtml(tssSerial)}</p>`
            : ""
        }
        ${
          signatureCounter != null
            ? `<p style="margin:0 0 4px;font-size:12px;color:#a1a1aa">Signaturzähler: ${escapeHtml(String(signatureCounter))}</p>`
            : ""
        }
        <p style="margin:0;font-size:11px;color:#71717a;word-break:break-all">Signatur: ${escapeHtml(signaturePreview)}…</p>
        ${qrBlock}
      </div>
    </div>

    ${trackLink}

    <div style="margin:24px 0 0;text-align:center" class="no-print">
      <button onclick="window.print()"
        style="background:#27272a;color:#fafafa;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer">
        Beleg drucken
      </button>
    </div>

    <p style="margin:32px 0 0;font-size:12px;color:#52525b;text-align:center">
      Dieser Beleg entspricht den Anforderungen der KassenSichV · Powered by QR Order
    </p>
  </div>
</body>
</html>`;
}

export function appendBelegTseEscPos(
  builder: EscPosBuilder,
  data: Pick<BelegData, "tseSignature" | "tseData">,
  paperWidth: PaperWidth = 80
): EscPosBuilder {
  const qrPayload = data.tseData.qr_code_data?.trim();

  builder
    .text(separatorLine(paperWidth))
    .newline()
    .align("center")
    .bold(true)
    .text("TSE-signiert (KassenSichV)")
    .newline()
    .bold(false)
    .align("left");

  if (data.tseData.tss_serial) {
    builder.text(`TSE-SN: ${data.tseData.tss_serial}`).newline();
  }

  if (data.tseData.signature_counter != null) {
    builder.text(`Signaturzähler: ${data.tseData.signature_counter}`).newline();
  }

  builder.text(`Signatur: ${data.tseSignature.slice(0, 32)}`).newline();

  if (qrPayload) {
    builder.newline().align("center");
    for (const line of wrapText(qrPayload, paperWidth)) {
      builder.text(line).newline();
    }
    builder.align("left");
  }

  builder
    .newline()
    .align("center")
    .text("KassenSichV-konformer Beleg")
    .newline()
    .align("left");

  return builder;
}

export function parseBelegTseData(raw: unknown): BelegTseData | null {
  if (!raw || typeof raw !== "object") return null;

  const row = raw as Record<string, unknown>;
  return {
    tss_serial: typeof row.tss_serial === "string" ? row.tss_serial : undefined,
    signature_counter:
      typeof row.signature_counter === "number"
        ? row.signature_counter
        : undefined,
    signature: typeof row.signature === "string" ? row.signature : undefined,
    qr_code_data:
      typeof row.qr_code_data === "string" ? row.qr_code_data : undefined,
  };
}

export async function loadBelegData(
  admin: SupabaseClient,
  orderId: string
): Promise<BelegData | null> {
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id, order_number, payment_status, subtotal, tax_amount, total, created_at, payment_method, tse_signature, tse_data, location_id, table_id, session_id, tax_percent"
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) return null;

  const row = order as {
    id: string;
    order_number: number;
    payment_status: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    created_at: string;
    payment_method: string;
    tse_signature: string | null;
    tse_data: unknown;
    location_id: string;
    table_id: string | null;
    tax_percent: number;
  };

  const tseData = parseBelegTseData(row.tse_data);
  if (!row.tse_signature || !tseData) return null;

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select(
      "name, org_id, address, city, postal_code, in_person_payment_location"
    )
    .eq("id", row.location_id)
    .single();

  if (locationError || !location) return null;

  const locationRow = location as {
    name: string;
    org_id: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    in_person_payment_location: "table" | "counter" | "bar";
  };

  const { data: orgData, error: orgError } = await admin
    .from("organizations")
    .select("name, currency, steuernummer, ust_id_nr")
    .eq("id", locationRow.org_id)
    .single();

  if (orgError || !orgData) return null;

  const org = orgData as {
    name: string;
    currency: string;
    steuernummer: string | null;
    ust_id_nr: string | null;
  };

  const { data: table } = row.table_id
    ? await admin
        .from("tables")
        .select("name")
        .eq("id", row.table_id)
        .is("deleted_at", null)
        .single()
    : { data: null };

  const tableRow = table as { name: string } | null;

  const { data: items } = await admin
    .from("order_items")
    .select("id, product_name, quantity, total, notes, tax_rate")
    .eq("order_id", orderId);

  const itemRows = (items ?? []) as Array<{
    id: string;
    product_name: string;
    quantity: number;
    total: number;
    notes: string | null;
    tax_rate: number;
  }>;

  const itemIds = itemRows.map((i) => i.id);
  const modifiersByItem = new Map<
    string,
    Array<{ modifier_name: string; price: number }>
  >();

  if (itemIds.length > 0) {
    const { data: modifiers } = await admin
      .from("order_item_modifiers")
      .select("order_item_id, modifier_name, price")
      .in("order_item_id", itemIds);

    for (const mod of (modifiers ?? []) as Array<{
      order_item_id: string;
      modifier_name: string;
      price: number;
    }>) {
      const list = modifiersByItem.get(mod.order_item_id) ?? [];
      list.push({ modifier_name: mod.modifier_name, price: Number(mod.price) });
      modifiersByItem.set(mod.order_item_id, list);
    }
  }

  const locationAddress = [
    locationRow.address,
    [locationRow.postal_code, locationRow.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    orgName: org.name,
    locationName: locationRow.name,
    locationAddress: locationAddress || null,
    steuernummer: org.steuernummer,
    ustIdNr: org.ust_id_nr,
    tableName: tableRow?.name ?? null,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    currency: org.currency ?? "EUR",
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    inPersonPaymentLocation: locationRow.in_person_payment_location,
    items: itemRows.map((item) => ({
      product_name: item.product_name,
      quantity: item.quantity,
      total: Number(item.total),
      tax_rate: Number(item.tax_rate ?? row.tax_percent),
      notes: item.notes,
      modifiers: modifiersByItem.get(item.id) ?? [],
    })),
    tseSignature: row.tse_signature,
    tseData,
  };
}
