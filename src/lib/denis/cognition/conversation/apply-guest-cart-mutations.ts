import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type { AiOrderDraft, ValidatedCartAction } from "@/lib/ai/ordering/draft-types";
import { extractTurnInterpretation } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import { classifyGuestIntent } from "@/lib/denis/cognition/tde/semantic-intent-router";
import type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";
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

/**
 * Deterministic mid-order cart edits — swap / remove before add-backfill.
 * `interpretation` should be the current turn's real LLM turnInterpretation
 * when available — only falls back to router/regex synthesis when absent.
 */
export function applyGuestCartMutations(
  draft: AiOrderDraft,
  catalog: AiCatalog,
  message: string,
  interpretation?: TurnInterpretation | null
): GuestCartMutationResult {
  const text = message.trim();
  if (!text || !draft.items.length) {
    return { draft, cartActions: [], swapped: false, removed: false };
  }

  const resolvedInterpretation =
    interpretation ?? extractTurnInterpretation({ guestMessage: text, llmUsed: false });

  const swap = parseGuestCartSwap(text, resolvedInterpretation);
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

  const removal = parseGuestRemoval(text, resolvedInterpretation);
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

/**
 * Mid-order product swap — not T0 cart.remove (handled by reflex).
 * `interpretation` should be the current turn's real LLM turnInterpretation
 * when available. The trailing contrastive-conjunction check only fires as
 * a last resort behind two non-regex signals (semantic router intent +
 * interpretation-based swap detection) — a narrow, low-risk residual gate
 * on whether to even attempt applyGuestCartMutations, not the swap
 * resolution itself.
 */
export function isMidOrderCartSwapMessage(
  message: string,
  interpretation?: TurnInterpretation | null
): boolean {
  const text = message.trim();
  if (!text) return false;
  const resolvedInterpretation =
    interpretation ?? extractTurnInterpretation({ guestMessage: text, llmUsed: false });
  if (parseGuestCartSwap(text, resolvedInterpretation) != null) return true;
  if (classifyGuestIntent(text).intent !== "modification") return false;
  return /\b(nego|sondern|but|umesto|instead of|instead)\b/i.test(text);
}
