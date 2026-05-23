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
          locationId={demo.locationId}
          taxPercent={demo.taxPercent}
          currency={demo.currency}
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
        organization:organizations!inner(
          default_tax_percent,
          currency,
          slug
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
    location_id: string;
    location: {
      organization: {
        slug: string;
        default_tax_percent: number;
        currency: string;
      };
    };
  };

  const org = table.location.organization;
  if (org.slug !== slug) notFound();

  return (
    <div className="min-h-dvh px-4 pb-safe pt-4">
      <GuestCheckoutHeader slug={slug} token={token} />
      <CheckoutForm
        slug={slug}
        token={token}
        locationId={table.location_id}
        taxPercent={Number(org.default_tax_percent)}
        currency={org.currency}
      />
    </div>
  );
}
