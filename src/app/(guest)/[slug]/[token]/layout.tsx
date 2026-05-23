import { notFound } from "next/navigation";
import { AppLocaleProvider } from "@/components/guest/app-locale-provider";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoGuestRoute } from "@/lib/demo-guest";
import { parseAvailableLocales } from "@/lib/i18n/locale-config";
import { parseLocale } from "@/lib/i18n/detect-locale";
import type { Locale } from "@/lib/i18n/translations";

export default async function GuestTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  let defaultLocale: Locale = "de";
  let availableLocales: Locale[] = ["de"];

  if (isDemoGuestRoute(slug, token)) {
    availableLocales = ["de", "en", "sr", "hr", "tr"];
    defaultLocale = "de";
  } else {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("tables")
        .select(
          "location:locations!inner(default_locale, available_locales, organization:organizations!inner(slug))"
        )
        .eq("qr_token", token)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();

      if (data) {
        const row = data as unknown as {
          location: {
            default_locale: string | null;
            available_locales: string[] | null;
            organization: { slug: string };
          };
        };
        if (row.location.organization.slug !== slug) {
          notFound();
        }
        defaultLocale = parseLocale(row.location.default_locale) ?? "de";
        availableLocales = parseAvailableLocales(
          row.location.available_locales,
          defaultLocale
        );
      }
    } catch {
      // Offline / partial schema — keep defaults
    }
  }

  return (
    <AppLocaleProvider
      slug={slug}
      token={token}
      defaultLocale={defaultLocale}
      availableLocales={availableLocales}
    >
      {children}
    </AppLocaleProvider>
  );
}
