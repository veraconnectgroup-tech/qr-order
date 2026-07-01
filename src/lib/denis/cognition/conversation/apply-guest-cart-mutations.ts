import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type { AiOrderDraft, ValidatedCartAction } from "@/lib/ai/ordering/draft-types";
import { extractTurnInterpretation } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import { classifyGuestIntent } from "@/lib/denis/cognition/tde/semantic-intent-router";
import {
  applyGuestCartSwap,
  applyGuestRemoval,
  parseGuestCartSwap,
  parseGuestRemoval,
} from "@/lib/denis/cognition/conversation/guest-substitution";

export type GuestCartMutationResult = {
  draft: AiOrderDraft;
  cartActions: ValidatedCartAction[];
  swapped: boolean;
  removed: boolean;
};

/** Deterministic mid-order cart edits — swap / remove before add-backfill. */
export function applyGuestCartMutations(
  draft: AiOrderDraft,
  catalog: AiCatalog,
  message: string
): GuestCartMutationResult {
  const text = message.trim();
  if (!text || !draft.items.length) {
    return { draft, cartActions: [], swapped: false, removed: false };
  }

  const swap = parseGuestCartSwap(
    text,
    extractTurnInterpretation({ guestMessage: text, llmUsed: false })
  );
  if (swap) {
    const { draft: next, swapped } = applyGuestCartSwap(
      draft,
      swap,
      catalog.catalog
    );
    if (swapped) {
      return {
        draft: next,
        cartActions: [],
        swapped: true,
        removed: false,
      };
    }
  }

  const removal = parseGuestRemoval(text);
  if (removal) {
    const { draft: next, removed } = applyGuestRemoval(draft, removal);
    if (removed) {
      return {
        draft: next,
        cartActions: [],
        swapped: false,
        removed: true,
      };
    }
  }

  return { draft, cartActions: [], swapped: false, removed: false };
}

/** Mid-order product swap — not T0 cart.remove (handled by reflex). */
export function isMidOrderCartSwapMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const interpretation = extractTurnInterpretation({ guestMessage: text, llmUsed: false });
  if (parseGuestCartSwap(text, interpretation) != null) return true;
  if (classifyGuestIntent(text).intent !== "modification") return false;
  return /\b(nego|sondern|but|umesto|instead of|instead)\b/i.test(text);
}
