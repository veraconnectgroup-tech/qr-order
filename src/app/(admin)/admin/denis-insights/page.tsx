import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadDenisProactiveAdminState } from "@/lib/admin/denis-proactive-actions";
import { loadLearnedEdgeQueue } from "@/lib/admin/denis-learned-edges";
import { loadThresholdOptimizationSnapshot } from "@/lib/admin/load-threshold-optimization";
import { loadNudgePerformanceSnapshot } from "@/lib/admin/load-nudge-performance";
import { loadAbandonmentPreventionSnapshot } from "@/lib/admin/load-abandonment-prevention";
import { loadVenueRhythmAdminSnapshot } from "@/lib/admin/load-venue-rhythm-admin";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadDenisInsightsAggregate } from "@/lib/admin/denis-debug";
import { DenisInsightsIntelligencePanel } from "@/components/admin/denis-insights-intelligence-panel";
import { DenisLearnedEdgesManager } from "@/components/admin/denis-learned-edges-manager";
import {
  DenisLiveOpsWidget,
  loadDenisLiveOpsSnapshot,
} from "@/components/admin/denis-live-ops-widget";
import { DenisNudgePerformancePanel } from "@/components/admin/denis-nudge-performance-panel";
import { DenisAbandonmentPreventionPanel } from "@/components/admin/denis-abandonment-prevention-panel";
import { DenisVenueRhythmPanel } from "@/components/admin/denis-venue-rhythm-panel";
import { DenisVenueKnowledgePanel } from "@/components/admin/denis-venue-knowledge-panel";
import { loadVenueKnowledgeAdminSnapshot } from "@/lib/admin/load-venue-knowledge-admin";
import { DenisProactiveSettingsPanel } from "@/components/admin/denis-proactive-settings-panel";
import { DenisThresholdOptimizationPanel } from "@/components/admin/denis-threshold-optimization-panel";
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
  const config = await loadConciergeConfigForLocation(locationId);
  const [edges, liveOps, proactiveState, nudgePerformance, abandonmentPrevention, venueRhythm, thresholdOpt, intelligence, venueKnowledge] =
    await Promise.all([
      loadLearnedEdgeQueue(admin, locationId, "pending"),
      loadDenisLiveOpsSnapshot(admin, locationId),
      loadDenisProactiveAdminState(),
      loadNudgePerformanceSnapshot(admin, { locationId, periodDays: 7 }),
      loadAbandonmentPreventionSnapshot(admin, { locationId, periodDays: 7 }),
      loadVenueRhythmAdminSnapshot(admin, { locationId, periodDays: 7 }),
      loadThresholdOptimizationSnapshot(admin, {
        locationId,
        config,
        periodDays: 14,
      }),
      loadDenisInsightsAggregate(admin, locationId, 14),
      loadVenueKnowledgeAdminSnapshot(admin, { locationId }),
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
      {intelligence ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Denis intelligence
          </h2>
          <DenisInsightsIntelligencePanel aggregate={intelligence} />
        </section>
      ) : null}
      <DenisLiveOpsWidget snapshot={liveOps} />
      {"error" in proactiveState ? null : (
        <DenisProactiveSettingsPanel initial={proactiveState} />
      )}
      <DenisNudgePerformancePanel snapshot={nudgePerformance} />
      <DenisAbandonmentPreventionPanel snapshot={abandonmentPrevention} />
      <DenisThresholdOptimizationPanel snapshot={thresholdOpt} />
      <DenisVenueRhythmPanel snapshot={venueRhythm} />
      <DenisVenueKnowledgePanel snapshot={venueKnowledge} />
      <DenisLearnedEdgesManager
        edges={edges}
        productNames={productNames}
        learnedEnabled={config.learning.learnedEdgesEnabled}
      />
    </div>
  );
}
