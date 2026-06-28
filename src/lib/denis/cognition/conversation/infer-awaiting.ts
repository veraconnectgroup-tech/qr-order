import type { ConversationAwaiting } from "@/lib/denis/cognition/beliefs/belief-types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";

const DENIS_QUESTION_PATTERN = /\?|da\s+li|jeste\s+li|have\s+you|haben\s+sie/i;

const BROWSE_DECISION_PATTERN =
  /\b(odlučili|odlučili\s+ste|decided|entschieden|have\s+you\s+decided|šta\s+biste|sta\s+biste|what\s+would\s+you)\b/i;

const RECOMMENDATION_PICK_PATTERN =
  /\b(ili|or|oder)\b.{0,60}\?/i;

const PRODUCT_CHOICE_PATTERN =
  /\b(koji|koja|koje|which|welche)\b.{0,50}\?/i;

const MULTI_OPTION_QUESTION_PATTERN =
  /(?:beef|chicken|veggie|pile[cć]i|goved|pilsner|weizen|lager).{0,40}(?:ili|or|oder).{0,40}(?:beef|chicken|veggie|pile[cć]i|goved|pilsner|weizen|lager)/i;

const MODIFIER_QUESTION_PATTERN =
  /\b(veličin\w*|velicin\w*|größe|grösse|size|bez\s+čega|which modifier|koji prilog|kakav prilog)\b.*\?/i;

const SERVE_SIZE_CHOICE_PATTERN =
  /\b0[,.][35]\s*l\b.{0,30}(?:ili|or|oder).{0,30}\b0[,.][35]\s*l\b.*\?/i;

const CONFIRM_RECAP_PATTERN =
  /\b(potvr[dđ]|confirm|da potvrdim|da li je to|is that (all|correct)|šaljem|send (this|order)|potvrđujete)\b/i;

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

  if (CONFIRM_RECAP_PATTERN.test(lastDenis)) {
    return "confirm";
  }

  if (BROWSE_DECISION_PATTERN.test(lastDenis)) {
    return "browse_decision";
  }

  if (MODIFIER_QUESTION_PATTERN.test(lastDenis) || SERVE_SIZE_CHOICE_PATTERN.test(lastDenis)) {
    return SERVE_SIZE_CHOICE_PATTERN.test(lastDenis) ? "serve_size" : "modifier";
  }

  if (
    RECOMMENDATION_PICK_PATTERN.test(lastDenis) ||
    PRODUCT_CHOICE_PATTERN.test(lastDenis) ||
    MULTI_OPTION_QUESTION_PATTERN.test(lastDenis)
  ) {
    return "recommendation_pick";
  }

  if (CLARIFY_INTENT_PATTERN.test(lastDenis)) {
    return "clarify_intent";
  }

  return null;
}
