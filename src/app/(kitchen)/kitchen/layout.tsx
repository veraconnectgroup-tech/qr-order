import { DashboardProvider } from "@/components/dashboard/dashboard-provider";
import { getStaffLocationContext } from "@/lib/auth/session";
import { requireSurface } from "@/lib/auth/require-surface";
import { StaffAccessProvider } from "@/lib/auth/staff-access-context";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardAlertsProvider } from "@/hooks/use-dashboard-alerts";
import { SoundAlertProvider } from "@/hooks/use-sound-alert";

export default async function KitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { staff, access } = await requireSurface("kitchen");

  const { locationId, accessibleLocations } = await getStaffLocationContext(staff);

  if (!locationId) {
    return (
      <div className="dashboard-theme flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        No location found for this account.
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: org }, { data: location }] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "id, name, slug, currency, logo_url, stripe_onboarded, onboarding_completed, trial_ends_at, fiskaly_tss_id, subscription_status"
      )
      .eq("id", staff.org_id)
      .single(),
    admin
      .from("locations")
      .select("name, in_person_payment_location, menu_locale, default_locale, ai_concierge_enabled")
      .eq("id", locationId)
      .single(),
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
    ai_concierge_enabled: boolean;
  } | null;

  const menuLocale = parseMenuLocaleFromDb(
    locationRow?.menu_locale,
    locationRow?.default_locale
  );

  return (
    <StaffAccessProvider access={access}>
      <DashboardProvider
        value={{
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
          todayRevenue: 0,
          stripeOnboarded: orgRow?.stripe_onboarded ?? false,
          hasTables: true,
          hasMenuItems: true,
          onboardingCompleted: orgRow?.onboarding_completed ?? true,
          trialEndsAt: orgRow?.trial_ends_at ?? null,
          subscriptionStatus: orgRow?.subscription_status ?? null,
          impersonating: staff.impersonating ?? false,
          impersonatedOrgName: staff.impersonated_org_name ?? null,
          inPersonPaymentLocation:
            locationRow?.in_person_payment_location ?? "bar",
          menuLocale,
          fiscalTssEnabled: Boolean(orgRow?.fiskaly_tss_id),
          aiConciergeEnabled: locationRow?.ai_concierge_enabled ?? false,
        }}
      >
        <SoundAlertProvider>
          <DashboardAlertsProvider>
            <div className="dashboard-theme min-h-dvh overflow-x-hidden bg-zinc-950 text-zinc-50 antialiased">
              {children}
            </div>
          </DashboardAlertsProvider>
        </SoundAlertProvider>
      </DashboardProvider>
    </StaffAccessProvider>
  );
}
