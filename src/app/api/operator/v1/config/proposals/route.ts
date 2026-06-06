import { apiError } from "@/lib/api-response";
import {
  createOperatorConfigProposal,
  parseConfigProposalBody,
} from "@/lib/operator/config-proposals";
import {
  operatorJson,
  withOperatorProposeRoute,
} from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withOperatorProposeRoute(
  "operator-v1-config-proposals-post",
  async (req, _ctx, auth) => {
    const body = await req.json().catch(() => null);
    const parsed = parseConfigProposalBody(body);

    if (!parsed) {
      return apiError("Invalid proposal body.", 400);
    }

    const admin = createAdminClient();
    const proposal = await createOperatorConfigProposal(admin, {
      orgId: auth.orgId,
      locationId: parsed.locationId,
      kind: "config",
      patch: parsed.patch,
      reason: parsed.reason,
      createdByKeyId: auth.keyId,
    });

    if (!proposal) {
      return apiError("Location not found or invalid patch.", 404);
    }

    return operatorJson({ proposal }, 201);
  }
);
