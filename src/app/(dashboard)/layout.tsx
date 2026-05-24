import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OnboardingGuard } from "@/components/dashboard/onboarding-guard";
import {
  getEffectiveStaff,
  getStaffAccessibleLocations,
  getStaffLocationId,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

import { sumOrderRevenue } from "@/lib/orders/revenue";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";

async function getTodayRevenue(locationId: string) {
  const admin = createAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await admin
    .from("orders")
    .select("total, status")
    .eq("location_id", locationId)
    .gte("created_at", todayStart.toISOString())
    .in("status", ["accepted", "preparing", "ready", "delivered"]);

  return sumOrderRevenue(
    (data ?? []) as Array<{ total: number; status: string }>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getEffectiveStaff();
  const [locationId, accessibleLocations] = await Promise.all([
    getStaffLocationId(staff),
    getStaffAccessibleLocations(staff),
  ]);

  if (!locationId) {
    return (
      <div className="dashboard-theme flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        No location found for this account.
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: org }, { data: location }, todayRevenue, { count: tableCount }, { count: productCount }] =
    await Promise.all([
    admin
      .from("organizations")
      .select("id, name, slug, currency, logo_url, stripe_onboarded, onboarding_completed, trial_ends_at, fiskaly_tss_id, subscription_status")
      .eq("id", staff.org_id)
      .single(),
    admin
      .from("locations")
      .select("name, in_person_payment_location, menu_locale, default_locale")
      .eq("id", locationId)
      .single(),
    getTodayRevenue(locationId),
    admin
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .is("deleted_at", null),
    admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .is("deleted_at", null),
  ]);

  const orgRow = org as {
    id: string;
    name: string;
    slug: string;
    currency: string;
    logo_url: string | null;
    stripe_onboarded: boolean;
    onboarding_completed: boolean;
    trial_ends_at: string | null;
    fiskaly_tss_id: string | null;
    subscription_status: string | null;
  } | null;

  const locationRow = location as {
    name: string;
    in_person_payment_location: "bar" | "counter" | "table";
    menu_locale: string | null;
    default_locale: string | null;
  } | null;

  const menuLocale = parseMenuLocaleFromDb(
    locationRow?.menu_locale,
    locationRow?.default_locale
  );

  return (
    <OnboardingGuard onboardingCompleted={orgRow?.onboarding_completed ?? true}>
      <DashboardShell
        context={{
          locationId,
          locationName: locationRow?.name ?? "Location",
          accessibleLocations,
          orgId: staff.org_id,
          orgName: orgRow?.name ?? "Restaurant",
          orgSlug: orgRow?.slug ?? staff.organizations?.slug ?? "",
          orgLogoUrl: orgRow?.logo_url ?? null,
          currency: orgRow?.currency ?? "EUR",
          staffName: staff.name,
          staffRole: staff.role,
          staffEmail: staff.email,
          todayRevenue,
          stripeOnboarded: orgRow?.stripe_onboarded ?? false,
          hasTables: (tableCount ?? 0) > 0,
          hasMenuItems: (productCount ?? 0) > 0,
        onboardingCompleted: orgRow?.onboarding_completed ?? true,
        trialEndsAt: orgRow?.trial_ends_at ?? null,
        subscriptionStatus: orgRow?.subscription_status ?? null,
        impersonating: staff.impersonating ?? false,
        impersonatedOrgName: staff.impersonated_org_name ?? null,
        inPersonPaymentLocation:
            locationRow?.in_person_payment_location ?? "bar",
          menuLocale,
          fiscalTssEnabled: Boolean(orgRow?.fiskaly_tss_id),
        }}
      >
        {children}
      </DashboardShell>
    </OnboardingGuard>
  );
}
