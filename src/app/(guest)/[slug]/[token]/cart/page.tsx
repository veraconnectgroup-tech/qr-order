import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { CartView } from "@/components/guest/cart-view";
import { getDemoGuestMenuProps, isDemoGuestRoute } from "@/lib/demo-guest";
import { parseGuestCartTable } from "@/lib/guest/parse-guest-table-rows";

export default async function CartPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const isDemo = isDemoGuestRoute(slug, token);

  if (isDemo) {
    const demo = getDemoGuestMenuProps(slug, token);
    return (
      <CartView
        slug={slug}
        token={token}
        locationId={demo.locationId}
        orgName={demo.orgName}
        tableName={demo.tableName}
        taxPercent={demo.taxPercent}
        currency={demo.currency}
        orderingEnabled={demo.orderingEnabled}
        acceptingOrders={demo.acceptingOrders}
      />
    );
  }

  let supabase;
  try {
    supabase = await createServerClient();
  } catch {
    notFound();
  }

  const { data: orgData } = await supabase
    .from("organizations")
    .select("name, default_tax_percent, currency")
    .eq("slug", slug)
    .single();

  if (!orgData) notFound();

  const org = orgData as {
    name: string;
    default_tax_percent: number;
    currency: string;
  };

  const { data: tableData } = await supabase
    .from("tables")
    .select(
      "name, location_id, location:locations!inner(accepting_orders, ordering_enabled)"
    )
    .eq("qr_token", token)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!tableData) notFound();

  const table = parseGuestCartTable(tableData);
  if (!table) notFound();

  if (!table.location.ordering_enabled) {
    redirect(`/${slug}/${token}`);
  }

  return (
    <CartView
      slug={slug}
      token={token}
      locationId={table.location_id}
      orgName={org.name}
      tableName={table.name}
      taxPercent={Number(org.default_tax_percent)}
      currency={org.currency}
      orderingEnabled={table.location.ordering_enabled}
      acceptingOrders={table.location.accepting_orders}
    />
  );
}
