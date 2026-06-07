import type {
  CommercePressure,
  ConversationAwaiting,
} from "@/lib/denis/cognition/beliefs/belief-types";
import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { getBeliefValue } from "@/lib/denis/cognition/beliefs/belief-types";
import { CORE_BELIEF_KEYS } from "@/lib/denis/cognition/beliefs/belief-types";
import type { TableSessionState } from "@/lib/denis/loop/types";

type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

function lastTranscriptLine(
  transcript: TranscriptMessage[] | undefined,
  role: TranscriptMessage["role"]
): string | null {
  if (!transcript?.length) return null;
  for (let i = transcript.length - 1; i >= 0; i--) {
    const entry = transcript[i];
    if (entry?.role !== role) continue;
    const text = entry.content.trim();
    if (text) return text;
  }
  return null;
}

/** Evidence block for perceive prompt (ADR-030). */
export function buildDialogueFrameEvidence(input: {
  beliefs: BeliefGraph;
  state?: TableSessionState | null;
  transcript?: TranscriptMessage[];
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
  const lastDenis =
    lastTranscriptLine(input.transcript, "assistant") ??
    input.state?.conversation.lastAssistantMessage?.trim() ??
    null;
  const lastGuest = lastTranscriptLine(input.transcript, "user");

  const lines = [
    "DIALOGUE FRAME (Denis must continue this thread — do not reset to generic welcome):",
    `- conversation.mode: ${mode ?? "unknown"}`,
    `- conversation.awaiting: ${awaiting ?? "null"}`,
    `- commerce.pressure: ${pressure ?? "none"}`,
    `- commerce.pending_slot: ${pendingSlot ?? "null"}`,
  ];

  if (lastGuest) {
    lines.push(`- last_guest_message: ${lastGuest.slice(0, 240)}`);
  }

  if (lastDenis) {
    lines.push(`- last_denis_message: ${lastDenis.slice(0, 240)}`);
    lines.push(
      "- instruction: Continue this thread — the guest is replying to your last message. Do NOT restart with a generic welcome. Acknowledge what they said, stay warm and brief, and offer one natural next step."
    );
  } else if (mode === "banter" || awaiting === null) {
    lines.push(
      "- instruction: Welcome phase — greet politely (good day, welcome), ask how you may help and if they have decided. Never pushy; no menu dump."
    );
  }

  if (awaiting === "serve_size") {
    lines.push(
      "- instruction: Guest is answering size/volume OR already said veliko/malo/0.5L in prior message — map to serve_size, fill proposedItems, do NOT re-ask."
    );
  }

  if (awaiting === "confirm" || pressure === "confirm") {
    lines.push(
      "- instruction: Guest is answering the order recap. Comprehend ANY natural affirmative in their language (super, ajde, može, ok, u redu, tamam, perfekt, sounds good…) → submitOrder true. Add/change → proposedItems. Never require magic words like confirm/potvrdi."
    );
  }

  if (awaiting === "browse_decision") {
    lines.push(
      "- instruction: Guest is answering whether they have decided — acknowledge patiently; if they need time, say you will check back. No menu dump."
    );
  }

  return lines.join("\n");
}
