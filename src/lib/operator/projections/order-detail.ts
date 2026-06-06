import {
  decimalToCents,
} from "@/lib/operator/projections/helpers";
import { normalizeOperatorPaymentMethod } from "@/lib/operator/fiscal-payment";
import { verifyOperatorLocation } from "@/lib/operator/verify-location";
import type {
  OperatorOrderDetail,
  OperatorTaxBreakdownLine,
} from "@/lib/operator/types";
import { groupGrossByRate } from "@/lib/tax/vat";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function projectOperatorOrderDetail(
  admin: SupabaseClient,
  input: { orgId: string; locationId: string; orderId: string }
): Promise<OperatorOrderDetail | null> {
  const location = await verifyOperatorLocation(
    admin,
    input.orgId,
    input.locationId
  );
  if (!location) return null;

  const { data: orderRow, error } = await admin
    .from("orders")
    .select(
      `
      id,
      order_number,
      status,
      payment_method,
      payment_status,
      subtotal,
      tax_amount,
      total,
      tip_amount,
      created_at,
      accepted_at,
      preparing_at,
      ready_at,
      delivered_at,
      session_id,
      order_items (
        id,
        product_name,
        quantity,
        unit_price,
        total,
        tax_rate,
        menu_section,
        notes,
        order_item_modifiers (
          modifier_name,
          price
        )
      )
    `
    )
    .eq("id", input.orderId)
    .eq("location_id", input.locationId)
    .maybeSingle();

  if (error || !orderRow) return null;

  const order = orderRow as {
    id: string;
    order_number: number;
    status: string;
    payment_method: string;
    payment_status: string;
    subtotal: number | string;
    tax_amount: number | string;
    total: number | string;
    tip_amount: number | string | null;
    created_at: string;
    accepted_at: string | null;
    preparing_at: string | null;
    ready_at: string | null;
    delivered_at: string | null;
    session_id: string | null;
    order_items: Array<{
      id: string;
      product_name: string;
      quantity: number;
      unit_price: number | string;
      total: number | string;
      tax_rate: number;
      menu_section: string;
      notes: string | null;
      order_item_modifiers: Array<{
        modifier_name: string;
        price: number | string;
      }> | null;
    }> | null;
  };

  const items = order.order_items ?? [];
  const taxBreakdown: OperatorTaxBreakdownLine[] = groupGrossByRate(
    items.map((item) => ({
      gross: Number(item.total),
      taxRate: Number(item.tax_rate ?? 19),
    }))
  ).map((row) => ({
    rate: row.rate,
    netCents: decimalToCents(row.net),
    taxCents: decimalToCents(row.tax),
    grossCents: decimalToCents(row.gross),
  }));

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    locationId: input.locationId,
    locationName: location.name,
    status: order.status,
    paymentMethod: normalizeOperatorPaymentMethod(order.payment_method),
    paymentMethodRaw: order.payment_method,
    paymentStatus: order.payment_status,
    subtotalCents: decimalToCents(order.subtotal),
    taxCents: decimalToCents(order.tax_amount),
    totalCents: decimalToCents(order.total),
    tipCents: decimalToCents(order.tip_amount),
    sessionId: order.session_id,
    createdAt: order.created_at,
    acceptedAt: order.accepted_at,
    preparingAt: order.preparing_at,
    readyAt: order.ready_at,
    deliveredAt: order.delivered_at,
    taxBreakdown,
    items: items.map((item) => ({
      id: item.id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPriceCents: decimalToCents(item.unit_price),
      totalCents: decimalToCents(item.total),
      taxRate: Number(item.tax_rate ?? 19),
      menuSection: item.menu_section,
      notes: item.notes,
      modifiers: (item.order_item_modifiers ?? []).map((modifier) => ({
        name: modifier.modifier_name,
        priceCents: decimalToCents(modifier.price),
      })),
    })),
  };
}
