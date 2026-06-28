import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { WaitlistView } from "@/components/guest/waitlist-view";

export const revalidate = 60;

export default async function GuestWaitlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let supabase;
  try {
    supabase = await createServerClient();
  } catch {
    notFound();
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) notFound();

  const { data: location } = await supabase
    .from("locations")
    .select("id, name")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!location) notFound();

  const { data: table } = await supabase
    .from("tables")
    .select("qr_token")
    .eq("location_id", location.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const browseToken = table?.qr_token ?? "menu";

  return (
    <WaitlistView
      slug={slug}
      locationId={location.id}
      orgName={org.name}
      locationName={location.name}
      logoUrl={org.logo_url}
      menuBrowseUrl={`/${slug}/${browseToken}`}
    />
  );
}
