import {
  assessWaiterObligation,
  lastOrderPlacementFromTranscript,
} from "@/lib/denis/cognition/waiter/assess-waiter-obligation";
import type { WaiterObligation } from "@/lib/denis/cognition/waiter/waiter-obligation-types";
import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { AllergyGuardResult } from "@/lib/denis/cognition/safety/allergy-guard";

/** Signal ingress that feeds the same obligation contract (ADR-020 §Kad / ARCH-6). */
export type ObligationSignalSource = "fold" | "turn" | "watcher" | "world";

export type MergeTableSessionObligationInput = {
  state: TableSessionState;
  source: ObligationSignalSource;
  /** Present on guest turn; empty on fold / watcher / world ticks. */
  guestMessage?: string | null;
  /** Turn path may pass post-ACT cart lines before state is re-folded. */
  cartLines?: DenisCartLine[];
  pendingSlot?: PendingSlotKind | null;
  atRecap?: boolean;
  language?: string | null;
  allergyGuard?: AllergyGuardResult | null;
  allergyAcknowledged?: boolean;
};

function resolveAtRecap(state: TableSessionState, override?: boolean): boolean {
  if (override !== undefined) return override;
  return (
    state.conversation.flowNodeId === "recap" ||
    state.conversation.flowNodeId === "submit"
  );
}

/**
 * ARCH-6 — watcher + world + turn share one obligation assessment.
 * Never read stale `conversation.obligation`; always merge from TRUTH inputs.
 */
export function mergeTableSessionObligation(
  input: MergeTableSessionObligationInput
): WaiterObligation {
  const { state } = input;
  const language =
    input.language ?? state.config.language?.venueDefault ?? "sr";

  return assessWaiterObligation({
    guestMessage: input.guestMessage ?? undefined,
    orderContextMessage: lastOrderPlacementFromTranscript(
      state.conversation.model.transcript
    ),
    cartLines: input.cartLines ?? state.commerce.cart.ai.draft.items,
    pendingSlot: input.pendingSlot ?? state.conversation.pendingSlot,
    language,
    atRecap: resolveAtRecap(state, input.atRecap),
    allergyGuard: input.allergyGuard,
    allergyAcknowledged: input.allergyAcknowledged,
  });
}

export function obligationForConversationState(
  obligation: WaiterObligation
): WaiterObligation | null {
  return obligation.gaps.length > 0 || obligation.inCart.length > 0
    ? obligation
    : null;
}

export function withMergedObligation(
  state: TableSessionState,
  obligation: WaiterObligation
): TableSessionState {
  return {
    ...state,
    conversation: {
      ...state.conversation,
      obligation: obligationForConversationState(obligation),
    },
  };
}
