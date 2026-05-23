import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/guest/checkout-form";
import { GuestCheckoutHeader } from "@/components/guest/guest-checkout-header";
import { getDemoGuestMenuProps, isDemoGuestRoute } from "@/lib/demo-guest";

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
          taxPercent={demo.taxPercent}
          currency={demo.currency}
        />
      </div>
    );
  }

  const supabase = await createServerClient();

  const { data: orgData } = await supabase
    .from("organizations")
    .select("default_tax_percent, currency")
    .eq("slug", slug)
    .single();

  if (!orgData) notFound();

  const org = orgData as {
    default_tax_percent: number;
    currency: string;
  };

  return (
    <div className="min-h-dvh px-4 pb-safe pt-4">
      <GuestCheckoutHeader slug={slug} token={token} />
      <CheckoutForm
        slug={slug}
        token={token}
        taxPercent={Number(org.default_tax_percent)}
        currency={org.currency}
      />
    </div>
  );
}
