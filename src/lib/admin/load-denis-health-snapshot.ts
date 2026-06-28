import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_DENIS_HEALTH_CONTRACT,
  evaluateDenisHealth,
  loadDenisHealthMetrics,
  loadStoredDegradationState,
  loadStoredHealthState,
  type DegradationLevel,
  type DenisHealthEvaluation,
  type DenisHealthMetrics,
} from "@/lib/denis/monitoring";

export type DenisHealthSnapshot = {
  metrics: DenisHealthMetrics;
  evaluation: DenisHealthEvaluation;
  metricsSource: "live" | "empty";
  featureLevel: "full" | "reduced" | "minimal";
  degradationLevel: DegradationLevel;
  degradationReason: string | null;
  degradationStaffMessage: string | null;
};

export async function loadDenisHealthSnapshot(
  admin: SupabaseClient,
  locationId: string
): Promise<DenisHealthSnapshot> {
  const { count: activeSessionCount } = await admin
    .from("table_sessions")
    .select("id", { count: "exact", head: true })
    .eq("location_id", locationId)
    .eq("status", "active");

  const metrics = await loadDenisHealthMetrics({
    locationId,
    activeSessionCount: activeSessionCount ?? 0,
  });

  const evaluation = evaluateDenisHealth(
    metrics,
    DEFAULT_DENIS_HEALTH_CONTRACT
  );

  const stored = await loadStoredHealthState(locationId);
  const degradation = await loadStoredDegradationState(locationId);

  return {
    metrics,
    evaluation,
    metricsSource: metrics.avgResponseMs > 0 ? "live" : "empty",
    featureLevel: stored?.featureLevel ?? "full",
    degradationLevel: degradation?.level ?? "full",
    degradationReason: degradation?.reason ?? null,
    degradationStaffMessage: degradation?.staffMessage ?? null,
  };
}
