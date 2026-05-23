import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { SplitPageClient } from "@/components/guest/split-page-client";

export default async function SplitBillPage({
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
      id,
      location:locations!inner(
        organization:organizations!inner(slug)
      )
    `
    )
    .eq("qr_token", token)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!tableData) notFound();

  const org = (
    tableData as unknown as {
      location: { organization: { slug: string } };
    }
  ).location.organization;

  if (org.slug !== slug) notFound();

  return (
    <Suspense
      fallback={
        <div className="animate-pulse px-4 py-8">
          <div className="h-8 w-48 rounded bg-zinc-800" />
        </div>
      }
    >
      <SplitPageClient slug={slug} token={token} />
    </Suspense>
  );
}
