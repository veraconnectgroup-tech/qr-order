import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { DenisRetentionPanel } from "@/components/admin/denis-retention-panel";
import { loadRetentionInsight } from "@/lib/denis/retention/load-retention-insight";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminRetentionPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-muted-foreground">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);

  const insight = await loadRetentionInsight(admin, {
    locationId,
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Retention</h1>
        <p className="text-sm text-muted-foreground">
          Denis guest engagement loop — win-back, loyalty, churn risk.
        </p>
      </div>
      <DenisRetentionPanel locationId={locationId} insight={insight} />
    </div>
  );
}
