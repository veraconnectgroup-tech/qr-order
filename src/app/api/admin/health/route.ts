import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import {
  runDeepHealthChecks,
  type DeepHealthPayload,
} from "@/lib/health/checks";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

type DenisVitals = {
  activeSessions: number;
  turnsLast5min: number;
  avgLatencyMs: number;
  t0Percent: number;
  errorRate: number;
};

async function loadDenisVitals(admin: ReturnType<typeof createAdminClient>): Promise<DenisVitals> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const [{ count: activeSessions }, { data: recentTraces }] = await Promise.all([
    admin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("denis_turn_traces")
      .select("total_duration_ms, tier, llm_used")
      .gte("created_at", fiveMinAgo)
      .limit(500),
  ]);

  const traces = (recentTraces ?? []) as Array<{
    total_duration_ms: number | null;
    tier: string | null;
    llm_used: boolean | null;
  }>;

  const turnsLast5min = traces.length;
  const avgLatencyMs =
    turnsLast5min > 0
      ? Math.round(
          traces.reduce((sum, row) => sum + (row.total_duration_ms ?? 0), 0) /
            turnsLast5min
        )
      : 0;
  const t0Count = traces.filter((row) => row.llm_used === false).length;
  const t0Percent =
    turnsLast5min > 0 ? Math.round((t0Count / turnsLast5min) * 100) : 0;

  return {
    activeSessions: activeSessions ?? 0,
    turnsLast5min,
    avgLatencyMs,
    t0Percent,
    errorRate: 0,
  };
}

export const GET = withErrorHandler("admin-health-get", async (req, _ctx) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return apiError("Unauthorized.", 401, undefined, noCache());
  }

  const [deepHealth, denis] = await Promise.all([
    runDeepHealthChecks(),
    loadDenisVitals(createAdminClient()),
  ]);

  const payload: DeepHealthPayload & { denis: DenisVitals; status: string } = {
    ...deepHealth,
    denis,
    status:
      deepHealth.status === "healthy" && denis.errorRate < 5
        ? "healthy"
        : "degraded",
  };

  return apiSuccess(payload, 200, noCache());
});
