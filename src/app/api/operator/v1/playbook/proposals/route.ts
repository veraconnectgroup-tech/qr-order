import { apiError } from "@/lib/api-response";
import {
  createOperatorConfigProposal,
  parsePlaybookProposalBody,
} from "@/lib/operator/config-proposals";
import {
  operatorJson,
  withOperatorProposeRoute,
} from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withOperatorProposeRoute(
  "operator-v1-playbook-proposals-post",
  async (req, _ctx, auth) => {
    const body = await req.json().catch(() => null);
    const parsed = parsePlaybookProposalBody(body);

    if (!parsed) {
      return apiError("Invalid playbook proposal body.", 400);
    }

    const admin = createAdminClient();
    const proposal = await createOperatorConfigProposal(admin, {
      orgId: auth.orgId,
      locationId: parsed.locationId,
      kind: "playbook",
      patch: { examples: parsed.examples },
      reason: parsed.reason,
      createdByKeyId: auth.keyId,
    });

    if (!proposal) {
      return apiError("Location not found.", 404);
    }

    return operatorJson({ proposal }, 201);
  }
);
