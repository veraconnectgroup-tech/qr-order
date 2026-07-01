import { inferAwaitingFromDialogue } from "@/lib/denis/cognition/conversation/infer-awaiting";
import { buildSessionSummary } from "@/lib/denis/cognition/conversation/build-session-summary";
import { extractGuestContinuityState } from "@/lib/denis/cognition/conversation/guest-continuity";
import { foldConversationGraph } from "@/lib/denis/cognition/conversation/topic-tracker";
import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const DENIS_QUESTION_PATTERN = /\?|da\s+li|jeste\s+li|have\s+you|haben\s+sie/i;

export function foldConversationModel(input: {
  timeline: DenisTimelineRow[];
  flowNodeId: FlowNodeId;
  pendingSlot: PendingSlotKind | null;
  commerceConfirm: boolean;
}): ConversationModel {
  const transcript = foldTranscriptFromTimeline(input.timeline);
  const continuity = extractGuestContinuityState(input.timeline);

  const guestTurns = transcript.filter((entry) => entry.role === "guest").length;
  const denisTurns = transcript.filter((entry) => entry.role === "denis").length;

  let lastGuestText: string | null = null;
  let lastDenisText: string | null = null;
  for (let i = transcript.length - 1; i >= 0; i--) {
    const entry = transcript[i]!;
    if (!lastGuestText && entry.role === "guest") {
      lastGuestText = entry.text;
    }
    if (!lastDenisText && entry.role === "denis") {
      lastDenisText = entry.text;
    }
    if (lastGuestText && lastDenisText) break;
  }

  const awaiting = inferAwaitingFromDialogue({
    lastDenisText,
    flowNodeId: input.flowNodeId,
    pendingSlot: input.pendingSlot,
    commerceConfirm: input.commerceConfirm,
    timeline: input.timeline,
  });

  const dialogueMessages = transcript
    .filter((entry) => entry.role === "guest" || entry.role === "denis")
    .map((entry) => ({
      role: entry.role as "guest" | "denis",
      text: entry.text,
    }));
  const graph = foldConversationGraph(dialogueMessages, input.timeline);

  const model: ConversationModel = {
    transcript,
    thread: {
      guestTurns,
      denisTurns,
      lastGuestText,
      lastDenisText,
      denisAskedQuestion: Boolean(
        lastDenisText && DENIS_QUESTION_PATTERN.test(lastDenisText)
      ),
    },
    awaiting,
    summary: null,
    attention: {
      browsingDeferred: continuity.deferCount > 0,
      deferCount: continuity.deferCount,
      followUpRequestedAt: continuity.followUpRequestedAt,
      followUpDelaySeconds: continuity.followUpDelaySeconds,
      followUpEmitted: continuity.followUpEmitted,
    },
    graph,
  };

  model.summary = buildSessionSummary(model);
  return model;
}
