import type {
  CommercePressure,
  ConversationAwaiting,
} from "@/lib/denis/cognition/beliefs/belief-types";
import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { getBeliefValue } from "@/lib/denis/cognition/beliefs/belief-types";
import { CORE_BELIEF_KEYS } from "@/lib/denis/cognition/beliefs/belief-types";
import type { TableSessionState } from "@/lib/denis/loop/types";

/** Evidence block for perceive prompt (ADR-030). */
export function buildDialogueFrameEvidence(input: {
  beliefs: BeliefGraph;
  state?: TableSessionState | null;
}): string {
  const mode = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  const awaiting = getBeliefValue<ConversationAwaiting>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const pressure = getBeliefValue<CommercePressure>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  const pendingSlot = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  const lastDenis = input.state?.conversation.lastAssistantMessage?.trim();

  const lines = [
    "DIALOGUE FRAME (Denis must continue this thread — do not reset to generic welcome):",
    `- conversation.mode: ${mode ?? "unknown"}`,
    `- conversation.awaiting: ${awaiting ?? "null"}`,
    `- commerce.pressure: ${pressure ?? "none"}`,
    `- commerce.pending_slot: ${pendingSlot ?? "null"}`,
  ];

  if (lastDenis) {
    lines.push(`- last_denis_message: ${lastDenis.slice(0, 240)}`);
  }

  if (awaiting === "serve_size") {
    lines.push(
      "- instruction: Guest is answering size/volume. Map typos (veliko povo → 0.5L). Return proposedItems with the pending productId + serveSize — do NOT ask again."
    );
  }

  if (awaiting === "confirm" || pressure === "confirm") {
    lines.push(
      "- instruction: Guest may confirm or adjust order recap. Contextual soft confirms (može, ajde) are valid."
    );
  }

  return lines.join("\n");
}
