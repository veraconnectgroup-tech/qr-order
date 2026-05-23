import { formatOrderNumber, formatPrice } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import {
  EscPosBuilder,
  formatAlignedLine,
  type PaperWidth,
  separatorLine,
} from "@/lib/printer/escpos-builder";
import type { Location, OrderWithDetails, Organization } from "@/types";

function formatReceiptTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildReceiptEscPos(
  order: OrderWithDetails,
  org: Pick<Organization, "name">,
  location: Pick<
    Location,
    "address" | "city" | "in_person_payment_location"
  >,
  paperWidth: PaperWidth = 80,
  currency = "EUR"
): Uint8Array {
  const tableName = order.tables?.name ?? "—";
  const addressLine = [location.address, location.city]
    .filter(Boolean)
    .join(", ");
  const paymentLabel = paymentMethodLabel(
    order.payment_method,
    location.in_person_payment_location
  );
  const paidSuffix = order.payment_status === "paid" ? " ✓" : "";

  const builder = new EscPosBuilder().initialize();

  builder
    .align("center")
    .bold(true)
    .text(org.name)
    .newline()
    .bold(false);

  if (addressLine) {
    builder.text(addressLine).newline();
  }

  builder
    .text(separatorLine(paperWidth))
    .newline()
    .align("left")
    .text(
      `${formatOrderNumber(order.order_number)} · ${tableName} · ${formatReceiptTime(order.created_at)}`
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
    .newline()
    .text(separatorLine(paperWidth))
    .newline()
    .align("center")
    .text("Danke / Hvala!")
    .newline(2)
    .cut();

  return builder.build();
}
