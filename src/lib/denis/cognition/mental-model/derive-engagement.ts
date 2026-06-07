import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import type { GuestEngagement } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";

export function deriveEngagement(input: {
  spine: GuestSignalSpine;
  conversation: ConversationModel;
}): GuestEngagement {
  const lengths = input.spine.guestMessages.map((message) => message.text.length);
  const guestTurns = input.conversation.thread.guestTurns;
  const avgMsgLen =
    lengths.length > 0
      ? lengths.reduce((sum, len) => sum + len, 0) / lengths.length
      : 0;

  const emitted = input.spine.proactivePairs.length;
  const responded = input.spine.proactivePairs.filter((pair) => pair.guestReplied).length;
  const nudgeResponseRate = emitted === 0 ? 0 : responded / emitted;

  return {
    guestTurns,
    avgMsgLen: Math.round(avgMsgLen),
    guestInitiated: input.spine.guestInitiatedBeforeDenis,
    nudgeResponseRate,
  };
}
