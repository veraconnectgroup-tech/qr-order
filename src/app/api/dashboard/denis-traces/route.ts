import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import type { TurnTrace } from "@/lib/denis/runtime/turn-trace";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "dashboard-denis-traces-get",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff || !["owner", "manager"].includes(staff.role)) {
      return apiError("Unauthorized.", 401, undefined, noCache());
    }

    const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim();
    if (!sessionId) {
      return apiError("Missing sessionId.", 400, undefined, noCache());
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400, undefined, noCache());
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("denis_turn_traces")
      .select("trace_id, created_at, total_duration_ms, tier, llm_used, total_tokens, trace_data")
      .eq("ai_session_id", sessionId)
      .eq("location_id", locationId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      return apiError(error.message, 500, undefined, noCache());
    }

    const turns = ((data ?? []) as Array<{
      trace_id: string;
      created_at: string;
      total_duration_ms: number | null;
      tier: string | null;
      llm_used: boolean | null;
      total_tokens: number | null;
      trace_data: TurnTrace;
    }>).map((row) => {
      const trace = row.trace_data;
      const {
        traceId: _traceId,
        totalDurationMs: _totalDurationMs,
        totalTokens: _totalTokens,
        ...traceRest
      } = trace ?? ({} as TurnTrace);
      return {
        ...traceRest,
        traceId: row.trace_id,
        createdAt: row.created_at,
        totalDurationMs:
          row.total_duration_ms ?? trace?.totalDurationMs ?? 0,
        tier: row.tier ?? trace?.phases?.plan?.tier ?? null,
        llmUsed: row.llm_used ?? trace?.phases?.perceive?.llmUsed ?? null,
        totalTokens: row.total_tokens ?? trace?.totalTokens ?? 0,
      };
    });

    return apiSuccess({ turns }, 200, noCache());
  }
);
