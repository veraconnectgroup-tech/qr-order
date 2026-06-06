import { apiError } from "@/lib/api-response";
import { getOperatorConfigProposal } from "@/lib/operator/config-proposals";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-config-proposal-get",
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    const admin = createAdminClient();
    const proposal = await getOperatorConfigProposal(admin, {
      orgId: auth.orgId,
      proposalId: id,
    });

    if (!proposal) {
      return apiError("Proposal not found.", 404);
    }

    return operatorJson({ proposal });
  }
);
