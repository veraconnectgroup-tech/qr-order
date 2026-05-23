import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function manifest({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<MetadataRoute.Manifest> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("name, logo_url")
    .eq("slug", slug)
    .maybeSingle();

  const org = data as { name: string; logo_url: string | null } | null;
  const name = org?.name ?? "QR Order";
  const iconSrc = org?.logo_url ?? "/icon-192.png";

  return {
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: `Order at ${name}`,
    start_url: `/${slug}`,
    scope: `/${slug}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#09090b",
    theme_color: "#f97316",
    icons: [
      {
        src: iconSrc,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: iconSrc,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: org?.logo_url ? iconSrc : "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
