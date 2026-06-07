import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import type { DeclineState } from "@/lib/denis/cognition/mental-model/decline-state";
import type { GuestReceptiveness } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";

export function deriveReceptiveness(input: {
  spine: GuestSignalSpine;
  decline: DeclineState;
  conversation: ConversationModel;
  browse: GuestBrowseProfile;
}): GuestReceptiveness {
  if (input.decline.hardClosed) return "closed";

  if (input.decline.dismissedCount >= 1 || input.decline.explicitCount >= 1) {
    return "polite_decline";
  }

  if (input.spine.recommendationAsked) return "enthusiastic";

  if (input.conversation.attention.deferCount >= 2) return "neutral";

  if (
    input.conversation.thread.guestTurns > 0 ||
    input.conversation.attention.browsingDeferred ||
    input.browse.eventCount > 0
  ) {
    return "open";
  }

  return "neutral";
}
