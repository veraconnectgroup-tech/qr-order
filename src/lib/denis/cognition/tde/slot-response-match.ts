import type { PendingSlotKind } from "@/lib/denis/cognition/tde/turn-plan-types";

/** Volume literals — 0.3, 0,5, 0.5l, etc. */
const SERVE_VOLUME_PATTERN =
  /^(0[,.]3|0[,.]33|0[,.]5|0[,.]50?|1|2)(\s*(l|liter|litre|litr))?$/i;

/** Single-token size labels (template quick replies). */
const SERVE_SIZE_LABEL_PATTERN =
  /^(mala|srednja|velika|malo|veliko|klein|mittel|gro[sß]|gross|small|medium|large)$/i;

/**
 * Narrow T0 match for pending slot replies — not an LLM gate (ADR-025).
 * Full phrases ("veliko pivo", typos) must go to transactional_perceive.
 */
export function matchesT0SlotAnswer(
  slot: PendingSlotKind | string,
  message: string
): boolean {
  const text = message.trim();
  if (!text) return false;

  if (slot === "serve_size") {
    return (
      SERVE_VOLUME_PATTERN.test(text) || SERVE_SIZE_LABEL_PATTERN.test(text)
    );
  }

  return false;
}

/** Guest is answering a pending slot — never re-show clarify template (T2). */
export function shouldUseLlmForPendingSlotReply(
  slot: PendingSlotKind | string,
  _message: string
): boolean {
  void slot;
  return true;
}
