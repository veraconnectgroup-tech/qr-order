import { formatOrderNumber, formatPrice } from "@/lib/format";
import { appendBelegTseEscPos, parseBelegTseData } from "@/lib/fiscal/beleg";
import { paymentMethodLabel } from "@/lib/payment-methods";
import {
  EscPosBuilder,
  formatAlignedLine,
  type PaperWidth,
  separatorLine,
} from "@/lib/printer/escpos-builder";
import type { Location, OrderWithDetails, Organization } from "@/types";

export const DENIS_RECEIPT_FOOTER = "Hvala što ste bili kod nas! ❤️";

export type ReceiptPrintOptions = {
  logoUrl?: string | null;
  footerMessage?: string;
  poweredByLabel?: string;
  hidePoweredBy?: boolean;
};

function formatReceiptTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildReceiptEscPos(
  order: OrderWithDetails,
  org: Pick<Organization, "name"> & { logo_url?: string | null },
  location: Pick<
    Location,
    "address" | "city" | "in_person_payment_location"
  >,
  paperWidth: PaperWidth = 80,
  currency = "EUR",
  options: ReceiptPrintOptions = {}
): Uint8Array {
  const tableName = order.tables?.name ?? "—";
  const addressLine = [location.address, location.city]
    .filter(Boolean)
    .join(", ");
  const paymentLabel = paymentMethodLabel(
    order.payment_method,
    location.in_person_payment_location as "table" | "counter" | "bar"
  );
  const paidSuffix = order.payment_status === "paid" ? " ✓" : "";
  const footer = options.footerMessage ?? DENIS_RECEIPT_FOOTER;
  const logoUrl = options.logoUrl ?? org.logo_url ?? null;
  const poweredBy =
    !options.hidePoweredBy && options.poweredByLabel
      ? options.poweredByLabel
      : null;

  const builder = new EscPosBuilder().initialize();

  builder.align("center");

  if (logoUrl) {
    builder
      .bold(true)
      .textSize(2, 2)
      .text("★")
      .newline()
      .textSize(1, 1)
      .bold(false);
  }

  builder
    .bold(true)
    .textSize(logoUrl ? 1 : 2, logoUrl ? 1 : 2)
    .text(org.name)
    .newline()
    .bold(false)
    .textSize(1, 1);

  if (addressLine) {
    builder.text(addressLine).newline();
  }

  builder
    .text(separatorLine(paperWidth))
    .newline()
    .align("left")
    .text(
      `${formatOrderNumber(order.order_number)} · ${tableName} · ${formatReceiptTime(order.created_at ?? new Date().toISOString())}`
    )
    .newline();

  for (const item of order.order_items ?? []) {
    const left = `${item.quantity}× ${item.product_name}`;
    const right = formatPrice(Number(item.total), currency);
    builder.text(formatAlignedLine(left, right, paperWidth)).newline();

    for (const mod of item.order_item_modifiers ?? []) {
      builder.text(`   → ${mod.modifier_name}`).newline();
    }

    if (item.notes) {
      builder.text(`   → ${item.notes}`).newline();
    }
  }

  builder.text(separatorLine(paperWidth)).newline();

  builder
    .text(
      formatAlignedLine(
        "Subtotal",
        formatPrice(Number(order.subtotal), currency),
        paperWidth
      )
    )
    .newline()
    .text(
      formatAlignedLine(
        `VAT ${Number(order.tax_percent)}%`,
        formatPrice(Number(order.tax_amount), currency),
        paperWidth
      )
    )
    .newline()
    .bold(true)
    .text(
      formatAlignedLine(
        "Total",
        formatPrice(Number(order.total), currency),
        paperWidth
      )
    )
    .newline()
    .bold(false)
    .text(`Payment: ${paymentLabel}${paidSuffix}`)
    .newline();

  const tseData = parseBelegTseData(order.tse_data);
  if (order.tse_signature && tseData) {
    appendBelegTseEscPos(
      builder,
      { tseSignature: order.tse_signature, tseData },
      paperWidth
    );
  }

  builder
    .text(separatorLine(paperWidth))
    .newline()
    .align("center")
    .text(footer)
    .newline();

  if (poweredBy) {
    builder.text(poweredBy).newline();
  }

  builder.newline().cut();

  return builder.build();
}
