import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { AppLocaleProvider } from "@/components/guest/app-locale-provider";
import { GuestSkipLink } from "@/components/guest/guest-skip-link";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoGuestRoute } from "@/lib/demo-guest";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";
import type { MenuLocale } from "@/lib/i18n/translations";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("organizations")
      .select("name, logo_url")
      .eq("slug", slug)
      .maybeSingle();

    const org = data as { name: string; logo_url: string | null } | null;
    return {
      manifest: `/${slug}/manifest.webmanifest`,
      title: org?.name,
      appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
      icons: org?.logo_url
        ? { apple: [{ url: org.logo_url }] }
        : { apple: [{ url: "/icon-192.png" }] },
    };
  } catch {
    return { manifest: `/${slug}/manifest.webmanifest` };
  }
}

export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default async function GuestTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  let menuLocale: MenuLocale = "de";
  let locationId = "demo-location";
  let orgName = "Restaurant";
  let logoUrl: string | null = null;

  if (isDemoGuestRoute(slug, token)) {
    menuLocale = "de";
    orgName = "Skyline Lounge";
  } else {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("tables")
        .select(
          `
          location_id,
          location:locations!inner(
            id,
            menu_locale,
            default_locale,
            organization:organizations!inner(slug, name, logo_url)
          )
        `
        )
        .eq("qr_token", token)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();

      if (data) {
        const row = data as unknown as {
          location_id: string;
          location: {
            id: string;
            menu_locale: string | null;
            default_locale: string | null;
            organization: { slug: string; name: string; logo_url: string | null };
          };
        };
        if (row.location.organization.slug !== slug) {
          notFound();
        }
        locationId = row.location.id;
        menuLocale = parseMenuLocaleFromDb(
          row.location.menu_locale,
          row.location.default_locale
        );
        orgName = row.location.organization.name;
        logoUrl = row.location.organization.logo_url;
      }
    } catch {
      // Offline / partial schema — keep defaults
    }
  }

  return (
    <AppLocaleProvider
      locationId={locationId}
      menuLocale={menuLocale}
      orgName={orgName}
      logoUrl={logoUrl}
    >
      <GuestSkipLink />
      <main id="main-content">{children}</main>
    </AppLocaleProvider>
  );
}
