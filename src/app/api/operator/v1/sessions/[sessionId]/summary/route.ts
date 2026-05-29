import { apiError } from "@/lib/api-response";
import { projectOperatorSessionSummary } from "@/lib/operator/projections/session-summary";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-session-summary-get",
  async (req, ctx, auth) => {
    const { sessionId } = await ctx.params;
    const includeTranscript =
      req.nextUrl.searchParams.get("include") === "transcript";

    const admin = createAdminClient();
    const summary = await projectOperatorSessionSummary(admin, {
      orgId: auth.orgId,
      sessionId,
      includeTranscript,
    });

    if (!summary) {
      return apiError("Session not found.", 404);
    }

    return operatorJson(summary);
  }
);
