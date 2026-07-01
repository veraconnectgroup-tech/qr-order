import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  applyDegradationTransition,
  healthMetricsToDegradationInput,
  loadDenisHealthMetrics,
  loadStoredDegradationState,
} from "@/lib/denis/monitoring";
import { withRateLimit } from "@/lib/rate-limit";
import { getCircuitBreakerStatus } from "@/lib/resilience/circuit-breaker";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "dashboard-denis-degradation-get",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401, undefined, noCache());
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400, undefined, noCache());
    }

    const admin = createAdminClient();
    const { count: activeSessionCount } = await admin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .eq("status", "active");

    const metrics = await loadDenisHealthMetrics({
      locationId,
      activeSessionCount: activeSessionCount ?? 0,
    });

    const config = await loadConciergeConfigForLocation(locationId);
    const transition = await applyDegradationTransition({
      locationId,
      health: healthMetricsToDegradationInput(metrics),
      config,
    });

    const stored = await loadStoredDegradationState(locationId);
    const [openai, fiskaly, stripe] = await Promise.all([
      getCircuitBreakerStatus("openai"),
      getCircuitBreakerStatus("fiskaly"),
      getCircuitBreakerStatus("stripe"),
    ]);

    return apiSuccess(
      {
        level: transition.resolution.level,
        reason: transition.resolution.reason,
        staffMessage: transition.resolution.staffMessage,
        disabledFeatures: transition.resolution.disabledFeatures,
        levelSince: stored?.levelSince ?? Date.now(),
        levelChanged: transition.levelChanged,
        metrics: {
          avgResponseMs: metrics.avgResponseMs,
          llmErrorRate: metrics.llmErrorRate,
        },
        circuits: {
          openai: openai.circuit,
          fiskaly: fiskaly.circuit,
          stripe: stripe.circuit,
        },
      },
      200,
      noCache()
    );
  }
);
