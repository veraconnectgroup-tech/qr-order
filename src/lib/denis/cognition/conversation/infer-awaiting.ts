import type { ConversationAwaiting } from "@/lib/denis/cognition/beliefs/belief-types";
import { extractTurnInterpretationFromTimeline } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export function inferAwaitingFromDialogue(input: {
  lastDenisText: string | null;
  flowNodeId: FlowNodeId;
  pendingSlot: PendingSlotKind | null;
  commerceConfirm: boolean;
  timeline?: DenisTimelineRow[];
}): ConversationAwaiting {
  if (input.commerceConfirm || input.flowNodeId === "recap") {
    return "confirm";
  }

  if (input.pendingSlot) {
    return input.pendingSlot as ConversationAwaiting;
  }

  if (input.timeline?.length) {
    const interpretation = extractTurnInterpretationFromTimeline(input.timeline);
    if (interpretation?.awaiting) {
      return interpretation.awaiting;
    }
  }

  return null;
}
