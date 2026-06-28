import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { AppLocaleProvider } from "@/components/guest/app-locale-provider";
import { GuestResilienceShell } from "@/components/guest/guest-resilience-shell";
import { GuestSkipLink } from "@/components/guest/guest-skip-link";
import { GuestSwCacheReset } from "@/components/guest/guest-sw-cache-reset";
import { GuestThemeInjector } from "@/components/theme/guest-theme-injector";
import { VenueThemeProvider } from "@/components/theme/venue-theme-context";
import { createServerClient } from "@/lib/supabase/server";
import { parseGuestLayoutTable } from "@/lib/guest/parse-guest-table-rows";
import { isDemoGuestRoute } from "@/lib/demo-guest";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";
import { SKYLINE_PILOT_LOCATION_ID } from "@/lib/denis/config/pilot-wiring";
import { guestPageMetadata } from "@/lib/seo/guest-metadata";
import { loadThemeForOrgLocation } from "@/lib/theme/load-theme-for-location";
import { resolveTheme, themeMetaColor } from "@/lib/theme/theme-resolver";
import type { ResolvedTheme } from "@/lib/theme/types";
import type { MenuLocale } from "@/lib/i18n/translations";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}): Promise<Metadata> {
  const { slug, token } = await params;

  if (isDemoGuestRoute(slug, token)) {
    return guestPageMetadata({
      orgName: "Skyline Lounge",
      slug,
      description:
        "Try the live demo menu — scan, order, and pay with QR Order.",
    });
  }

  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("organizations")
      .select("name, logo_url")
      .eq("slug", slug)
      .maybeSingle();

    const org = data as { name: string; logo_url: string | null } | null;
    if (!org) {
      return guestPageMetadata({ orgName: "Menu", slug, noIndex: true });
    }

    return guestPageMetadata({
      orgName: org.name,
      slug,
      logoUrl: org.logo_url,
    });
  } catch {
    return guestPageMetadata({ orgName: "Menu", slug, noIndex: true });
  }
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}): Promise<Viewport> {
  const { slug, token } = await params;
  let themeColor = "#f97316";

  if (!isDemoGuestRoute(slug, token)) {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("tables")
        .select("location_id")
        .eq("qr_token", token)
        .maybeSingle();
      const locationId = (data as { location_id: string } | null)?.location_id;
      if (locationId) {
        const theme = await loadThemeForOrgLocation({
          orgName: "",
          locationId,
        });
        themeColor = themeMetaColor(theme);
      }
    } catch {
      // keep default
    }
  }

  return {
    themeColor,
    interactiveWidget: "resizes-content",
  };
}

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

  let theme: ResolvedTheme | null = null;

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
        const row = parseGuestLayoutTable(data);
        if (!row || row.location.organization.slug !== slug) {
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

    if (locationId !== "demo-location") {
      theme = await loadThemeForOrgLocation({
        orgName,
        logoUrl,
        locationId,
      });
    }
  }

  if (locationId === SKYLINE_PILOT_LOCATION_ID) {
    menuLocale = "sr";
  }

  const resolvedTheme =
    theme ??
    resolveTheme({
      orgName,
      logoUrl,
    });

  return (
    <VenueThemeProvider theme={resolvedTheme}>
      <AppLocaleProvider
        locationId={locationId}
        menuLocale={menuLocale}
        orgName={orgName}
        logoUrl={logoUrl}
      >
        <GuestThemeInjector theme={resolvedTheme} />
        <GuestSwCacheReset />
        <GuestSkipLink />
        <GuestResilienceShell>
          <main id="main-content">{children}</main>
        </GuestResilienceShell>
      </AppLocaleProvider>
    </VenueThemeProvider>
  );
}
