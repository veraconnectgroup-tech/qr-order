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

  const { data: orgData } = await supabase
    .from("organizations")
    .select("default_tax_percent, currency, stripe_onboarded")
    .eq("slug", slug)
    .single();

  if (!orgData) notFound();

  const org = orgData as {
    default_tax_percent: number;
    currency: string;
    stripe_onboarded: boolean;
  };

  return (
    <div className="min-h-dvh px-4 pb-safe pt-4">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <Link
          href={`/${slug}/${token}/cart`}
          className="touch-target inline-flex items-center text-zinc-400"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-heading text-zinc-50">Payment</h1>
      </header>

      <CheckoutForm
        slug={slug}
        token={token}
        taxPercent={Number(org.default_tax_percent)}
        currency={org.currency}
        stripeOnboarded={org.stripe_onboarded}
      />
    </div>
  );
}
