import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { OrderPageClient } from "@/components/guest/order-page-client";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ slug: string; token: string; orderId: string }>;
}) {
  const { slug, token, orderId } = await params;
  const supabase = await createServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("currency")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  return (
    <OrderPageClient
      slug={slug}
      token={token}
      orderId={orderId}
      currency={(org as { currency: string }).currency}
    />
  );
}
