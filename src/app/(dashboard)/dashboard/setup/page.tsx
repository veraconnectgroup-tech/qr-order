import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";
import { getStaffLocationId, requireStaff } from "@/lib/auth/session";
import { getServerAppUrl } from "@/lib/app-url";
import type { OnboardingProgressState } from "@/lib/dashboard/onboarding-progress";
import { ONBOARDING_STEP_IDS } from "@/lib/dashboard/onboarding-progress";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";
import type { VenuePlaybookTone } from "@/lib/admin/generate-venue-playbook";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripePlatformConfigured } from "@/lib/stripe/connect";

function parseOnboardingProgress(raw: unknown): OnboardingProgressState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as {
    completedSteps?: unknown;
    skippedSteps?: unknown;
  };
  const allowed = new Set<string>(ONBOARDING_STEP_IDS);
  const completedSteps = Array.isArray(value.completedSteps)
    ? value.completedSteps.filter(
        (step): step is (typeof ONBOARDING_STEP_IDS)[number] =>
          typeof step === "string" && allowed.has(step)
      )
    : [];
  const skippedSteps = Array.isArray(value.skippedSteps)
    ? value.skippedSteps.filter(
        (step): step is (typeof ONBOARDING_STEP_IDS)[number] =>
          typeof step === "string" && allowed.has(step)
      )
    : [];
  return { completedSteps, skippedSteps };
}

export default async function SetupPage() {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    redirect("/dashboard/orders");
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const [
    { data: org },
    { data: location },
    { data: categories },
    { data: tables },
    { count: productCount },
    { count: categoryCount },
    { count: tableCount },
  ] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "name, slug, logo_url, currency, stripe_onboarded, stripe_account_id, onboarding_completed, fiskaly_tss_id, steuernummer, ust_id_nr, created_at, ai_concierge_config"
      )
      .eq("id", staff.org_id)
      .single(),
    admin
      .from("locations")
      .select("name, address, city, postal_code, timezone, menu_locale, default_locale, ai_concierge_config")
      .eq("id", locationId)
      .single(),
    admin
      .from("categories")
      .select("id, name, menu_section")
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    admin
      .from("tables")
      .select("id, name, qr_token")
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .is("deleted_at", null),
    admin
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .is("deleted_at", null),
    admin
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .is("deleted_at", null),
  ]);

  const orgRow = org as {
    name: string;
    slug: string;
    logo_url: string | null;
    currency: string;
    stripe_onboarded: boolean;
    stripe_account_id: string | null;
    onboarding_completed: boolean;
    fiskaly_tss_id: string | null;
    steuernummer: string | null;
    ust_id_nr: string | null;
    created_at: string;
    ai_concierge_config: Record<string, unknown> | null;
  } | null;

  if (orgRow?.onboarding_completed) {
    redirect("/dashboard/orders");
  }

  const locationRow = location as {
    name: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    timezone: string;
    menu_locale: string | null;
    default_locale: string | null;
    ai_concierge_config: Record<string, unknown> | null;
  } | null;

  const orgConfig = orgRow?.ai_concierge_config ?? {};
  const locationConfig = locationRow?.ai_concierge_config ?? {};
  const menuLocale = parseMenuLocaleFromDb(
    locationRow?.menu_locale,
    locationRow?.default_locale
  );

  return (
    <OnboardingWizard
      orgName={orgRow?.name ?? "Restaurant"}
      orgSlug={orgRow?.slug ?? ""}
      logoUrl={orgRow?.logo_url ?? null}
      primaryColor={
        typeof locationConfig.brandPrimaryColor === "string"
          ? locationConfig.brandPrimaryColor
          : "#f97316"
      }
      address={locationRow?.address ?? null}
      city={locationRow?.city ?? null}
      postalCode={locationRow?.postal_code ?? null}
      timezone={locationRow?.timezone ?? "Europe/Berlin"}
      currency={orgRow?.currency ?? "EUR"}
      categories={(categories ?? []) as Array<{
        id: string;
        name: string;
        menu_section: string;
      }>}
      initialTables={
        (tables ?? []) as Array<{ id: string; name: string; qr_token: string }>
      }
      stripeOnboarded={orgRow?.stripe_onboarded ?? false}
      stripeAccountId={orgRow?.stripe_account_id ?? null}
      stripePlatformReady={isStripePlatformConfigured()}
      tssId={orgRow?.fiskaly_tss_id ?? null}
      steuernummer={orgRow?.steuernummer ?? null}
      ustIdNr={orgRow?.ust_id_nr ?? null}
      productCount={productCount ?? 0}
      categoryCount={categoryCount ?? 0}
      tableCount={tableCount ?? 0}
      appUrl={getServerAppUrl()}
      menuLocale={menuLocale}
      playbookPackId={
        typeof orgConfig.playbookPackId === "string"
          ? orgConfig.playbookPackId
          : null
      }
      denisTone={
        typeof locationConfig.tone === "string"
          ? (locationConfig.tone as VenuePlaybookTone)
          : null
      }
      orgCreatedAt={orgRow?.created_at ?? null}
      initialProgress={parseOnboardingProgress(orgConfig.onboardingProgress)}
    />
  );
}
