import type { ConversationAwaiting } from "@/lib/denis/cognition/beliefs/belief-types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";

const DENIS_QUESTION_PATTERN = /\?|da\s+li|jeste\s+li|have\s+you|haben\s+sie/i;

const BROWSE_DECISION_PATTERN =
  /\b(odlučili|odlučili\s+ste|decided|entschieden|have\s+you\s+decided|šta\s+biste|sta\s+biste|what\s+would\s+you)\b/i;

const RECOMMENDATION_PICK_PATTERN =
  /\b(ili|or|oder)\b.{0,60}\?/i;

const CLARIFY_INTENT_PATTERN =
  /\b(piće|pice|jelo|drink|food|essen|trinken|meni|menu)\b.*\?/i;

export function inferAwaitingFromDialogue(input: {
  lastDenisText: string | null;
  flowNodeId: FlowNodeId;
  pendingSlot: PendingSlotKind | null;
  commerceConfirm: boolean;
}): ConversationAwaiting {
  if (input.commerceConfirm || input.flowNodeId === "recap") {
    return "confirm";
  }

  if (input.pendingSlot) {
    return input.pendingSlot as ConversationAwaiting;
  }

  const lastDenis = input.lastDenisText?.trim() ?? "";
  if (!lastDenis || !DENIS_QUESTION_PATTERN.test(lastDenis)) {
    return null;
  }

  if (BROWSE_DECISION_PATTERN.test(lastDenis)) {
    return "browse_decision";
  }

  if (RECOMMENDATION_PICK_PATTERN.test(lastDenis)) {
    return "recommendation_pick";
  }

  if (CLARIFY_INTENT_PATTERN.test(lastDenis)) {
    return "clarify_intent";
  }

  return null;
}
