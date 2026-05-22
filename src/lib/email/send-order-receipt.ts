import { buildOrderReceiptHtml } from "@/lib/email/order-receipt-html";
import { sendEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export async function maybeSendOrderReceipt(orderId: string) {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order) return;

  const row = order as {
    id: string;
    order_number: number;
    status: string;
    payment_status: string;
    subtotal: number;
    tax_percent: number;
    tax_amount: number;
    total: number;
    created_at: string;
    session_id: string | null;
    receipt_sent_at: string | null;
    location_id: string;
    table_id: string | null;
  };

  if (row.receipt_sent_at) return;

  const shouldSend =
    row.payment_status === "paid" ||
    (row.status === "delivered" && row.payment_status === "pending");

  if (!shouldSend) return;

  let guestEmail: string | null = null;

  if (row.session_id) {
    const { data: session } = await admin
      .from("table_sessions")
      .select("guest_email")
      .eq("id", row.session_id)
      .single();

    guestEmail = (session as { guest_email: string | null } | null)?.guest_email ?? null;
  }

  if (!guestEmail) return;

  const { data: items } = await admin
    .from("order_items")
    .select("id, product_name, quantity, total, notes")
    .eq("order_id", orderId);

  const itemRows = (items ?? []) as Array<{
    id: string;
    product_name: string;
    quantity: number;
    total: number;
    notes: string | null;
  }>;

  const itemIds = itemRows.map((i) => i.id);
  let modifiersByItem = new Map<string, Array<{ modifier_name: string; price: number }>>();

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

  const { data: location } = await admin
    .from("locations")
    .select("name, org_id")
    .eq("id", row.location_id)
    .single();

  const { data: table } = row.table_id
    ? await admin.from("tables").select("name, qr_token").eq("id", row.table_id).single()
    : { data: null };

  const locationRow = location as { name: string; org_id: string } | null;
  if (!locationRow) return;

  const { data: orgData } = await admin
    .from("organizations")
    .select("name, slug, currency")
    .eq("id", locationRow.org_id)
    .single();

  const org = orgData as { name: string; slug: string; currency: string } | null;
  const tableRow = table as { name: string; qr_token: string } | null;

  const orderItems = itemRows.map((item) => ({
    product_name: item.product_name,
    quantity: item.quantity,
    total: Number(item.total),
    notes: item.notes,
    modifiers: modifiersByItem.get(item.id) ?? [],
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const orderUrl =
    org?.slug && tableRow?.qr_token
      ? `${appUrl}/${org.slug}/${tableRow.qr_token}/order/${orderId}`
      : undefined;

  const html = buildOrderReceiptHtml({
    orgName: org?.name ?? "Your venue",
    locationName: locationRow.name,
    tableName: tableRow?.name ?? null,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    subtotal: Number(row.subtotal),
    taxPercent: Number(row.tax_percent),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    currency: org?.currency ?? "EUR",
    paymentStatus: row.payment_status,
    items: orderItems,
    orderUrl,
  });

  const result = await sendEmail({
    to: guestEmail,
    subject: `Receipt ${org?.name ?? ""} — Order #${String(row.order_number).padStart(3, "0")}`.trim(),
    html,
  });

  if ("ok" in result && result.ok) {
    await admin
      .from("orders")
      .update({ receipt_sent_at: new Date().toISOString() } as never)
      .eq("id", orderId);
  }
}
