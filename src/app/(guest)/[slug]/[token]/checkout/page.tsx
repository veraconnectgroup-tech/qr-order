import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/guest/checkout-form";
import { GuestCheckoutHeader } from "@/components/guest/guest-checkout-header";
import { getDemoGuestMenuProps, isDemoGuestRoute } from "@/lib/demo-guest";
import { parseGuestCheckoutTable } from "@/lib/guest/parse-guest-table-rows";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const isDemo = isDemoGuestRoute(slug, token);

  if (isDemo) {
    const demo = getDemoGuestMenuProps(slug, token);
    return (
      <div className="min-h-dvh px-4 pb-safe pt-4">
        <GuestCheckoutHeader slug={slug} token={token} />
        <CheckoutForm
          slug={slug}
          token={token}
          locationId={demo.locationId}
          taxPercent={demo.taxPercent}
          currency={demo.currency}
          isDemo
          paymentOnlineEnabled
          paymentAtBarEnabled
          stripeOnboarded
        />
      </div>
    );
  }

  const supabase = await createServerClient();

  const { data: tableData } = await supabase
    .from("tables")
    .select(
      `
      location_id,
      location:locations!inner(
        ordering_enabled,
        accepting_orders,
        payment_online_enabled,
        payment_at_bar_enabled,
        payment_card_at_table_enabled,
        organization:organizations!inner(
          default_tax_percent,
          currency,
          slug,
          stripe_onboarded
        )
      )
    `
    )
    .eq("qr_token", token)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!tableData) notFound();

  const table = parseGuestCheckoutTable(tableData);
  if (!table) notFound();

  const org = table.location.organization;
  if (org.slug !== slug) notFound();

  const loc = table.location as unknown as {
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
    organization: { stripe_onboarded: boolean };
  };

  if (!table.location.ordering_enabled) {
    redirect(`/${slug}/${token}`);
  }

  return (
    <div className="min-h-dvh px-4 pb-safe pt-4">
      <GuestCheckoutHeader slug={slug} token={token} />
      <CheckoutForm
        slug={slug}
        token={token}
        locationId={table.location_id}
        taxPercent={Number(org.default_tax_percent)}
        currency={org.currency}
        acceptingOrders={table.location.accepting_orders}
        paymentOnlineEnabled={loc.payment_online_enabled}
        paymentAtBarEnabled={loc.payment_at_bar_enabled}
        paymentCardAtTableEnabled={loc.payment_card_at_table_enabled}
        stripeOnboarded={Boolean(loc.organization.stripe_onboarded)}
      />
    </div>
  );
}
