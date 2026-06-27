import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  buildOperatorProposalPreviews,
  type OperatorProposalPreview,
} from "@/lib/admin/build-operator-proposal-previews";
import type { OperatorConfigProposal } from "@/lib/operator/config-proposals";

export async function loadOperatorProposalPreviews(
  admin: SupabaseClient,
  proposals: OperatorConfigProposal[]
): Promise<OperatorProposalPreview[]> {
  if (proposals.length === 0) {
    return [];
  }

  const locationIds = [...new Set(proposals.map((row) => row.locationId))];
  const { data, error } = await admin
    .from("locations")
    .select("id, ai_concierge_config")
    .in("id", locationIds);

  if (error) {
    throw new Error(error.message);
  }

  const configByLocationId = new Map<string, ReturnType<typeof parsePartialConciergeConfig>>();
  for (const row of data ?? []) {
    const typed = row as { id: string; ai_concierge_config: unknown };
    configByLocationId.set(
      typed.id,
      parsePartialConciergeConfig(typed.ai_concierge_config)
    );
  }

  return buildOperatorProposalPreviews(configByLocationId, proposals);
}
