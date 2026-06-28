import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import { emptyConversationGraph } from "@/lib/denis/cognition/conversation/conversation-graph";

/** Test / eval fixture — empty folded conversation. */
export function emptyConversationModel(): ConversationModel {
  return {
    transcript: [],
    thread: {
      guestTurns: 0,
      denisTurns: 0,
      lastGuestText: null,
      lastDenisText: null,
      denisAskedQuestion: false,
    },
    awaiting: null,
    summary: null,
    attention: {
      browsingDeferred: false,
      deferCount: 0,
      followUpRequestedAt: null,
      followUpDelaySeconds: null,
      followUpEmitted: false,
    },
    graph: emptyConversationGraph(),
  };
}
