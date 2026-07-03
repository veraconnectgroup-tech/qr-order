import { DenisOwnerRoiPanel } from "@/components/admin/denis-owner-roi-panel";
import { loadOrgMultiVenueRoiSummary } from "@/lib/admin/load-org-multi-venue-roi";
import { AdminVenueHubSelector } from "@/components/admin/admin-venue-hub-selector";
import { loadDenisOwnerRoiDashboard } from "@/lib/billing/denis-roi-tracker";
import { loadPlanById } from "@/lib/billing/plans";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminDenisRoiPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-muted-foreground">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .single();

  const orgId = location?.org_id;
  if (!orgId) {
    return (
      <p className="text-sm text-muted-foreground">Organization not found.</p>
    );
  }

  const { data: org } = await admin
    .from("organizations")
    .select("plan_id, currency")
    .eq("id", orgId)
    .single();

  const planId = org?.plan_id ?? "business";
  const currency = org?.currency ?? "EUR";

  const plan = await loadPlanById(planId);
  const [dashboard, multiVenue] = await Promise.all([
    loadDenisOwnerRoiDashboard(admin, {
      orgId,
      locationId,
      planId,
      planPriceCents: plan?.price_cents ?? 4900,
      currency,
    }),
    loadOrgMultiVenueRoiSummary(admin, orgId),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-dash-text-primary">
          Denis ROI
        </h1>
        <p className="text-sm text-dash-text-secondary">
          Tačno koliko Denis zarađuje za vaš restoran — brojevi koji sprečavaju
          otkazivanje pretplate.
        </p>
      </div>

      {multiVenue ? (
        <AdminVenueHubSelector
          summary={multiVenue}
          currentLocationId={locationId}
        />
      ) : null}

      <DenisOwnerRoiPanel dashboard={dashboard} currency={currency} />
    </div>
  );
}
