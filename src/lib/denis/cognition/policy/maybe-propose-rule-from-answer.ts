import type { SupabaseClient } from "@supabase/supabase-js";
import { assessRuleCandidate } from "@/lib/denis/cognition/perceive/assess-rule-candidate";
import { resolveRuleProposalPolicy } from "@/lib/denis/cognition/policy/resolve-rule-proposal-policy";
import { proposeRestaurantRule } from "@/lib/denis/knowledge/restaurant-knowledge-store";

/**
 * Architecture Proposal §7/§16 step 7 — the shared entry point for "a
 * colleague told Denis something worth remembering." One implementation,
 * callable from wherever a staff member's free-text answer to Denis is
 * available (today: station voice transcripts, Denis Menu Agent chat —
 * see each call site's own docstring for why it fires this
 * fire-and-forget, never blocking the primary response).
 *
 * Always non-blocking by design at the call site: this is a secondary
 * side-channel, never allowed to add latency or a failure mode to the
 * actual conversation Denis is having.
 */
export async function maybeProposeRuleFromAnswer(
  admin: SupabaseClient,
  input: {
    locationId: string;
    answerText: string;
    staffId: string | null;
    sourceAiSessionId?: string | null;
  }
): Promise<{ proposed: boolean; id: string | null }> {
  const assessment = await assessRuleCandidate(input.answerText);
  const action = resolveRuleProposalPolicy(assessment);
  if (action !== "propose_pending" || !assessment?.ruleText) {
    return { proposed: false, id: null };
  }

  const result = await proposeRestaurantRule(admin, {
    locationId: input.locationId,
    text: assessment.ruleText,
    proposedByStaffId: input.staffId,
    sourceAiSessionId: input.sourceAiSessionId,
  });

  return result.ok ? { proposed: true, id: result.id } : { proposed: false, id: null };
}
