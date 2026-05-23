import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { CartView } from "@/components/guest/cart-view";

export default async function CartPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const supabase = await createServerClient();

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
    .select("name, location:locations!inner(accepting_orders)")
    .eq("qr_token", token)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!tableData) notFound();

  const table = tableData as unknown as {
    name: string;
    location: { accepting_orders: boolean };
  };

  return (
    <CartView
      slug={slug}
      token={token}
      orgName={org.name}
      tableName={table.name}
      taxPercent={Number(org.default_tax_percent)}
      currency={org.currency}
      orderingEnabled={table.location.accepting_orders}
    />
  );
}
