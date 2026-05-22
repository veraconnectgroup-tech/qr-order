import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/guest/checkout-form";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const supabase = await createServerClient();

  const { data: tableData } = await supabase
    .from("tables")
    .select(
      `
      location:locations!inner(
        payment_online_enabled,
        payment_at_bar_enabled,
        payment_card_at_table_enabled,
        organization:organizations!inner(
          slug,
          default_tax_percent,
          currency,
          stripe_onboarded
        )
      )
    `
    )
    .eq("qr_token", token)
    .eq("is_active", true)
    .single();

  if (!tableData) notFound();

  const row = tableData as unknown as {
    location: {
      payment_online_enabled: boolean;
      payment_at_bar_enabled: boolean;
      payment_card_at_table_enabled: boolean;
      organization: {
        slug: string;
        default_tax_percent: number;
        currency: string;
        stripe_onboarded: boolean;
      };
    };
  };

  if (row.location.organization.slug !== slug) notFound();

  const org = row.location.organization;

  return (
    <div className="min-h-dvh px-4 pb-safe pt-4">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <Link
          href={`/${slug}/${token}/cart`}
          className="touch-target inline-flex items-center text-zinc-400"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-heading text-zinc-50">Checkout</h1>
      </header>

      <CheckoutForm
        slug={slug}
        token={token}
        taxPercent={Number(org.default_tax_percent)}
        currency={org.currency}
        stripeOnboarded={org.stripe_onboarded}
        paymentOnlineEnabled={row.location.payment_online_enabled ?? true}
        paymentAtBarEnabled={row.location.payment_at_bar_enabled ?? true}
        paymentCardAtTableEnabled={
          row.location.payment_card_at_table_enabled ?? true
        }
      />
    </div>
  );
}
