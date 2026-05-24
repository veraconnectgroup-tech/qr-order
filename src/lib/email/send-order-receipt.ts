import { buildBelegHtml, parseBelegTseData } from "@/lib/fiscal/beleg";
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
    tse_signature: string | null;
    tse_data: unknown;
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
    .select(
      "name, org_id, address, city, postal_code, in_person_payment_location"
    )
    .eq("id", row.location_id)
    .single();

  const { data: table } = row.table_id
    ? await admin
        .from("tables")
        .select("name, qr_token")
        .eq("id", row.table_id)
        .is("deleted_at", null)
        .single()
    : { data: null };

  const locationRow = location as {
    name: string;
    org_id: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    in_person_payment_location: "table" | "counter" | "bar";
  } | null;
  if (!locationRow) {
    return { sent: false, error: "Location not found." };
  }

  const { data: orgData } = await admin
    .from("organizations")
    .select("name, slug, currency, steuernummer, ust_id_nr")
    .eq("id", locationRow.org_id)
    .single();

  const org = orgData as {
    name: string;
    slug: string;
    currency: string;
    steuernummer: string | null;
    ust_id_nr: string | null;
  } | null;
  const tableRow = table as { name: string; qr_token: string } | null;

  const orderItems = itemRows.map((item) => ({
    product_name: item.product_name,
    quantity: item.quantity,
    total: Number(item.total),
    tax_rate: Number(item.tax_rate ?? row.tax_percent),
    notes: item.notes,
    modifiers: modifiersByItem.get(item.id) ?? [],
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const orderUrl =
    org?.slug && tableRow?.qr_token
      ? `${appUrl}/${org.slug}/${tableRow.qr_token}/order/${orderId}`
      : undefined;
  const belegUrl = row.beleg_token
    ? `${appUrl}/api/beleg/${row.beleg_token}`
    : undefined;

  const locationAddress = [
    locationRow.address,
    [locationRow.postal_code, locationRow.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const tseData = parseBelegTseData(row.tse_data);
  const useFiscalBeleg = Boolean(row.tse_signature && tseData);

  const html = useFiscalBeleg
    ? await buildBelegHtml({
        orgName: org?.name ?? "Your venue",
        locationName: locationRow.name,
        locationAddress: locationAddress || null,
        steuernummer: org?.steuernummer ?? null,
        ustIdNr: org?.ust_id_nr ?? null,
        tableName: tableRow?.name ?? null,
        orderNumber: row.order_number,
        createdAt: row.created_at,
        subtotal: Number(row.subtotal),
        taxAmount: Number(row.tax_amount),
        total: Number(row.total),
        currency: org?.currency ?? "EUR",
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        inPersonPaymentLocation: locationRow.in_person_payment_location,
        items: orderItems,
        tseSignature: row.tse_signature!,
        tseData: tseData!,
        orderUrl: belegUrl ?? orderUrl,
      })
    : buildOrderReceiptHtml({
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
        items: orderItems.map(({ tax_rate: _taxRate, ...item }) => item),
        orderUrl,
      });

  const subjectPrefix = useFiscalBeleg ? "Kassenbeleg" : "Receipt";
  const result = await sendEmail({
    to: guestEmail,
    subject: `${subjectPrefix} ${org?.name ?? ""} — Order #${String(row.order_number).padStart(3, "0")}`.trim(),
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
