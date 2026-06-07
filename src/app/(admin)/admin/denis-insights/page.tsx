import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadDenisProactiveAdminState } from "@/lib/admin/denis-proactive-actions";
import { loadLearnedEdgeQueue } from "@/lib/admin/denis-learned-edges";
import { loadNudgePerformanceSnapshot } from "@/lib/admin/load-nudge-performance";
import { loadVenueRhythmAdminSnapshot } from "@/lib/admin/load-venue-rhythm-admin";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { DenisLearnedEdgesManager } from "@/components/admin/denis-learned-edges-manager";
import {
  DenisLiveOpsWidget,
  loadDenisLiveOpsSnapshot,
} from "@/components/admin/denis-live-ops-widget";
import { DenisNudgePerformancePanel } from "@/components/admin/denis-nudge-performance-panel";
import { DenisVenueRhythmPanel } from "@/components/admin/denis-venue-rhythm-panel";
import { DenisProactiveSettingsPanel } from "@/components/admin/denis-proactive-settings-panel";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DenisInsightsAdminPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-muted-foreground">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const [edges, config, liveOps, proactiveState, nudgePerformance, venueRhythm] =
    await Promise.all([
      loadLearnedEdgeQueue(admin, locationId, "pending"),
      loadConciergeConfigForLocation(locationId),
      loadDenisLiveOpsSnapshot(admin, locationId),
      loadDenisProactiveAdminState(),
      loadNudgePerformanceSnapshot(admin, { locationId, periodDays: 7 }),
      loadVenueRhythmAdminSnapshot(admin, { locationId, periodDays: 7 }),
    ]);

  const productIds = [
    ...new Set(
      edges.flatMap((edge) => [edge.from_product_id, edge.to_product_id])
    ),
  ];

  const productNames: Record<string, string> = {};
  if (productIds.length) {
    const { data: products } = await admin
      .from("products")
      .select("id, name")
      .in("id", productIds);

    for (const product of (products ?? []) as Array<{ id: string; name: string }>) {
      productNames[product.id] = product.name;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <DenisLiveOpsWidget snapshot={liveOps} />
      {"error" in proactiveState ? null : (
        <DenisProactiveSettingsPanel initial={proactiveState} />
      )}
      <DenisNudgePerformancePanel snapshot={nudgePerformance} />
      <DenisVenueRhythmPanel snapshot={venueRhythm} />
      <DenisLearnedEdgesManager
        edges={edges}
        productNames={productNames}
        learnedEnabled={config.learning.learnedEdgesEnabled}
      />
    </div>
  );
}
