import { notFound } from "next/navigation";
import { AppLocaleProvider } from "@/components/guest/app-locale-provider";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoGuestRoute } from "@/lib/demo-guest";
import type { Locale } from "@/lib/i18n/translations";
import { parseLocale } from "@/lib/i18n/detect-locale";

export default async function GuestTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  let defaultLocale: Locale = "de";

  if (!isDemoGuestRoute(slug, token)) {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("tables")
        .select("location:locations!inner(default_locale, organization:organizations!inner(slug))")
        .eq("qr_token", token)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();

      if (data) {
        const row = data as unknown as {
          location: {
            default_locale: string | null;
            organization: { slug: string };
          };
        };
        if (row.location.organization.slug !== slug) {
          notFound();
        }
        defaultLocale = parseLocale(row.location.default_locale) ?? "de";
      }
    } catch {
      // Demo / offline — keep de fallback
    }
  }

  return (
    <AppLocaleProvider slug={slug} token={token} defaultLocale={defaultLocale}>
      {children}
    </AppLocaleProvider>
  );
}
