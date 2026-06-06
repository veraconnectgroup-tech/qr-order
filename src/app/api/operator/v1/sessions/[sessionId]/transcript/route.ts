import { apiError } from "@/lib/api-response";
import { projectOperatorSessionTranscript } from "@/lib/operator/projections/session-transcript";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-session-transcript-get",
  async (req, ctx, auth) => {
    const { sessionId } = await ctx.params;
    const includePii = req.nextUrl.searchParams.get("include") === "pii";

    const admin = createAdminClient();
    const transcript = await projectOperatorSessionTranscript(admin, {
      orgId: auth.orgId,
      sessionId,
      includePii,
    });

    if (!transcript) {
      return apiError("Session not found.", 404);
    }

    return operatorJson(transcript);
  }
);
