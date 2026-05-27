import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { OrderPageClient } from "@/components/guest/order-page-client";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ slug: string; token: string; orderId: string }>;
}) {
  const { slug, token, orderId } = await params;
  const supabase = await createServerClient();

  const { data: tableData } = await supabase
    .from("tables")
    .select(
      `
      id,
      location:locations!inner(
        id,
        payment_online_enabled,
        payment_at_bar_enabled,
        payment_card_at_table_enabled,
        google_review_url,
        organization:organizations!inner(
          slug,
          currency,
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

  const table = tableData as unknown as {
    id: string;
    location: {
      id: string;
      payment_online_enabled: boolean;
      payment_at_bar_enabled: boolean;
      payment_card_at_table_enabled: boolean;
      google_review_url: string | null;
      organization: {
        slug: string;
        currency: string;
        stripe_onboarded: boolean;
      };
    };
  };

  const org = table.location.organization;
  if (org.slug !== slug) notFound();

  const conciergeConfig = await loadConciergeConfigForLocation(table.location.id);

  return (
    <OrderPageClient
      slug={slug}
      token={token}
      orderId={orderId}
      tableId={table.id}
      locationId={table.location.id}
      returnGuestEnabled={conciergeConfig.memory.returnGuestEnabled}
      currency={org.currency}
      stripeOnboarded={org.stripe_onboarded}
      paymentOnlineEnabled={table.location.payment_online_enabled}
      paymentAtBarEnabled={table.location.payment_at_bar_enabled}
      paymentCardAtTableEnabled={table.location.payment_card_at_table_enabled}
      googleReviewUrl={table.location.google_review_url}
      inPersonPaymentLocation="bar"
    />
  );
}
