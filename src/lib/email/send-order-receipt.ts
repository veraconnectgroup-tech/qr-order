import { buildBelegHtml, loadBelegData } from "@/lib/fiscal/beleg";
import { buildOrderReceiptHtml } from "@/lib/email/order-receipt-html";
import { sendEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

type SendReceiptResult = { sent: boolean; error?: string };

export async function sendOrderReceipt(
  orderId: string,
  options?: { force?: boolean }
): Promise<SendReceiptResult> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order) {
    return { sent: false, error: "Order not found." };
  }

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
    payment_method: string;
    beleg_token: string | null;
  };

  if (row.receipt_sent_at && !options?.force) {
    return { sent: false, error: "Receipt already sent." };
  }

  const shouldSend =
    row.payment_status === "paid" ||
    (row.status === "delivered" && row.payment_status === "pending");

  if (!shouldSend) {
    return { sent: false, error: "Order is not eligible for a receipt." };
  }

  let guestEmail: string | null = null;

  if (row.session_id) {
    const { data: session } = await admin
      .from("table_sessions")
      .select("guest_email")
      .eq("id", row.session_id)
      .single();

    guestEmail =
      (session as { guest_email: string | null } | null)?.guest_email ?? null;
  }

  if (!guestEmail) {
    return { sent: false, error: "No guest email on file." };
  }

  const belegData = await loadBelegData(admin, orderId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let html: string;
  let subjectPrefix: string;
  let orgName = "Your venue";

  if (belegData) {
    orgName = belegData.orgName;
    const belegUrl = row.beleg_token
      ? `${appUrl}/api/beleg/${row.beleg_token}`
      : undefined;

    let orderUrl: string | undefined;
    if (!belegUrl && row.table_id) {
      const { data: location } = await admin
        .from("locations")
        .select("org_id")
        .eq("id", row.location_id)
        .single();
      const orgId = (location as { org_id: string } | null)?.org_id;
      if (orgId) {
        const [{ data: orgData }, { data: table }] = await Promise.all([
          admin.from("organizations").select("slug").eq("id", orgId).single(),
          admin
            .from("tables")
            .select("qr_token")
            .eq("id", row.table_id)
            .is("deleted_at", null)
            .single(),
        ]);
        const slug = (orgData as { slug: string } | null)?.slug;
        const qrToken = (table as { qr_token: string } | null)?.qr_token;
        if (slug && qrToken) {
          orderUrl = `${appUrl}/${slug}/${qrToken}/order/${orderId}`;
        }
      }
    }

    html = await buildBelegHtml({
      ...belegData,
      orderUrl: belegUrl ?? orderUrl,
    });
    subjectPrefix = "Kassenbeleg";
  } else {
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

    const { data: location } = await admin
      .from("locations")
      .select("name, org_id")
      .eq("id", row.location_id)
      .single();

    const locationRow = location as { name: string; org_id: string } | null;
    if (!locationRow) {
      return { sent: false, error: "Location not found." };
    }

    const { data: orgData } = await admin
      .from("organizations")
      .select("name, slug, currency")
      .eq("id", locationRow.org_id)
      .single();

    const org = orgData as {
      name: string;
      slug: string;
      currency: string;
    } | null;

    orgName = org?.name ?? "Your venue";

    const { data: table } = row.table_id
      ? await admin
          .from("tables")
          .select("name, qr_token")
          .eq("id", row.table_id)
          .is("deleted_at", null)
          .single()
      : { data: null };

    const tableRow = table as { name: string; qr_token: string } | null;

    const orderUrl =
      org?.slug && tableRow?.qr_token
        ? `${appUrl}/${org.slug}/${tableRow.qr_token}/order/${orderId}`
        : undefined;

    html = buildOrderReceiptHtml({
      orgName,
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
      items: itemRows.map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        total: Number(item.total),
        notes: item.notes,
        modifiers: modifiersByItem.get(item.id) ?? [],
      })),
      orderUrl,
    });
    subjectPrefix = "Receipt";
  }

  const result = await sendEmail({
    to: guestEmail,
    subject: `${subjectPrefix} ${orgName} — Order #${String(row.order_number).padStart(3, "0")}`.trim(),
    html,
  });

  if ("ok" in result && result.ok) {
    await admin
      .from("orders")
      .update({ receipt_sent_at: new Date().toISOString() } as never)
      .eq("id", orderId);
    return { sent: true };
  }

  return { sent: false, error: "Email delivery failed." };
}

export async function maybeSendOrderReceipt(orderId: string) {
  await sendOrderReceipt(orderId);
}

export async function resendOrderReceipt(orderId: string) {
  return sendOrderReceipt(orderId, { force: true });
}
