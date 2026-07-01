import {
  retrieveCombinedVkgEvidence,
  retrieveVkgAllergyEvidence,
  retrieveVkgExplainEvidence,
  retrieveVkgPairingEvidence,
  retrieveVkgSubstituteEvidence,
} from "@/lib/denis/cognition/context/retrievers/vkg-pairing-evidence";
import { isVagueRecommendMessage } from "@/lib/denis/cognition/tde/decide-turn-plan";
import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import {
  allergySafeMenuProductIds,
  explainPopularProducts,
  loadVenueKnowledgeGraph,
  pairingForSafe,
  substitutesForUnavailable,
  type VenueKnowledgeGraph,
} from "@/lib/denis/kernel/vkg";
import type { TableSessionState } from "@/lib/denis/loop/types";

function collectCartProductIds(input: {
  state?: TableSessionState | null;
  reflexTurn: ReflexTurnResult;
}): string[] {
  const ids = new Set<string>();

  for (const line of input.state?.commerce.cart.visibleLines ?? []) {
    if (line.productId) ids.add(line.productId);
  }

  for (const line of input.reflexTurn.cartState.draft.items) {
    if (line.productId) ids.add(line.productId);
  }

  return [...ids];
}

export type TurnVkgEvidenceInput = {
  config: ConciergeConfig;
  state?: TableSessionState | null;
  reflexTurn: ReflexTurnResult;
  guestAllergens?: string[];
  guestMessage?: string;
  turnPlan?: TurnPlan | null;
  unavailableProductIds?: string[];
  popularProductIds?: string[];
};

/** Pure VKG evidence assembly — testable without DB. */
export function buildTurnVkgEvidenceBlock(
  graph: VenueKnowledgeGraph,
  input: TurnVkgEvidenceInput
): string | null {
  const guestAllergens = input.guestAllergens ?? [];
  const guestMessage = input.guestMessage?.trim() ?? "";
  const unavailableProductIds = input.unavailableProductIds ?? [];
  const blocks: Array<string | null> = [];

  if (guestAllergens.length > 0) {
    const safeIds = allergySafeMenuProductIds(graph, guestAllergens);
    const safeNames = safeIds
      .map((productId) => graph.products[productId]?.name)
      .filter(Boolean) as string[];
    blocks.push(
      retrieveVkgAllergyEvidence({
        guestAllergens,
        safeProductNames: safeNames,
      })
    );
  }

  const wantsRecommend =
    isVagueRecommendMessage(guestMessage) ||
    input.turnPlan?.reason?.startsWith("vague_recommend") === true;

  if (wantsRecommend) {
    blocks.push(
      retrieveVkgExplainEvidence(
        explainPopularProducts(
          graph,
          input.popularProductIds ?? [],
          guestAllergens,
          { limit: 3 }
        )
      )
    );
  }

  if (unavailableProductIds.length > 0 || guestMessage) {
    blocks.push(
      retrieveVkgSubstituteEvidence(
        substitutesForUnavailable(graph, {
          unavailableProductIds,
          guestMessage,
          limit: 2,
        })
      )
    );
  }

  const cartProductIds = collectCartProductIds(input);
  if (input.config.proactive.pairing && cartProductIds.length > 0) {
    blocks.push(
      retrieveVkgPairingEvidence(
        pairingForSafe(graph, cartProductIds, guestAllergens, { limit: 3 })
      )
    );
  }

  return retrieveCombinedVkgEvidence(blocks);
}

/** Load VKG pairing/substitute/explain hints for Situation Pack. */
export async function loadTurnVkgPairingBlock(
  input: TurnVkgEvidenceInput & { locationId: string }
): Promise<string | null> {
  try {
    const graph = await loadVenueKnowledgeGraph(input.locationId);
    return buildTurnVkgEvidenceBlock(graph, input);
  } catch {
    return null;
  }
}
