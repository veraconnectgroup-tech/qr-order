import { retrieveVkgPairingEvidence } from "@/lib/denis/cognition/context/retrievers/vkg-pairing-evidence";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import {
  loadVenueKnowledgeGraph,
  pairingForSafe,
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

/** Load VKG pairing hints for Situation Pack when proactive pairing is enabled. */
export async function loadTurnVkgPairingBlock(input: {
  locationId: string;
  config: ConciergeConfig;
  state?: TableSessionState | null;
  reflexTurn: ReflexTurnResult;
  guestAllergens?: string[];
}): Promise<string | null> {
  if (!input.config.proactive.pairing) return null;

  const cartProductIds = collectCartProductIds(input);
  if (cartProductIds.length === 0) return null;

  try {
    const graph = await loadVenueKnowledgeGraph(input.locationId);
    const pairings = pairingForSafe(
      graph,
      cartProductIds,
      input.guestAllergens ?? [],
      { limit: 3 }
    );
    return retrieveVkgPairingEvidence(pairings);
  } catch {
    return null;
  }
}
