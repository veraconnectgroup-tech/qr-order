import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadLiveAbAdminSnapshot } from "@/lib/admin/denis-live-ab";
import { DenisLiveAbPanel } from "@/components/admin/denis-live-ab-panel";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AbExperimentsAdminPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-muted-foreground">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const snapshot = await loadLiveAbAdminSnapshot(admin, locationId);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">A/B experiments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Denis testira strategije uživo — jedan aktivan eksperiment po lokaciji.
          Dodela varijante: hash(session + experiment) % 1000. Posle{" "}
          {snapshot.experiment?.min_sessions ?? 100} sesija po varijanti, Bayesian
          test bira pobednika; auto-apply zahteva owner odobrenje.
        </p>
      </div>

      <DenisLiveAbPanel snapshot={snapshot} />
    </div>
  );
}
