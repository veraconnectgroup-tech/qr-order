import { withErrorHandler } from "@/lib/api/with-error-handler";
import { buildBelegHtml, parseBelegTseData } from "@/lib/fiscal/beleg";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f-]{36}$/i;

function notFound() {
  return new Response(null, { status: 404 });
}

export const GET = withErrorHandler("beleg-token-get", async (_req, ctx) => {
  const { token } = await ctx.params;

  if (!UUID_RE.test(token)) {
    return notFound();
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_number, status, payment_status, subtotal, tax_amount, total, created_at, payment_method, tse_signature, tse_data, location_id, table_id"
    )
    .eq("beleg_token", token)
    .single();

  if (!order) {
    return notFound();
  }

  const row = order as {
    id: string;
    order_number: number;
    status: string;
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
  };

  const tseData = parseBelegTseData(row.tse_data);
  if (!row.tse_signature || !tseData) {
    return notFound();
  }

  const { data: items } = await admin
    .from("order_items")
    .select("id, product_name, quantity, total, notes, tax_rate")
    .eq("order_id", row.id);

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

  const locationRow = location as {
    name: string;
    org_id: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    in_person_payment_location: "table" | "counter" | "bar";
  } | null;

  if (!locationRow) {
    return notFound();
  }

  const { data: orgData } = await admin
    .from("organizations")
    .select("name, currency, steuernummer, ust_id_nr")
    .eq("id", locationRow.org_id)
    .single();

  const org = orgData as {
    name: string;
    currency: string;
    steuernummer: string | null;
    ust_id_nr: string | null;
  } | null;

  const { data: table } = row.table_id
    ? await admin
        .from("tables")
        .select("name")
        .eq("id", row.table_id)
        .is("deleted_at", null)
        .single()
    : { data: null };

  const tableRow = table as { name: string } | null;

  const orderItems = itemRows.map((item) => ({
    product_name: item.product_name,
    quantity: item.quantity,
    total: Number(item.total),
    tax_rate: Number(item.tax_rate ?? 19),
    notes: item.notes,
    modifiers: modifiersByItem.get(item.id) ?? [],
  }));

  const locationAddress = [
    locationRow.address,
    [locationRow.postal_code, locationRow.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const html = await buildBelegHtml({
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
    tseSignature: row.tse_signature,
    tseData,
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
});
