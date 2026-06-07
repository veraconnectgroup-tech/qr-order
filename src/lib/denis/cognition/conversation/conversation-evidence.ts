import type { ConversationModel } from "@/lib/denis/cognition/conversation/conversation-types";
import { retrieveTranscriptWindowEvidence } from "@/lib/denis/cognition/context/retrievers/transcript-window";

function awaitingInstruction(awaiting: ConversationModel["awaiting"]): string | null {
  switch (awaiting) {
    case "browse_decision":
      return "Guest may still be browsing — acknowledge, do not push menu; offer to check back if they defer again.";
    case "recommendation_pick":
      return "Guest is choosing between options Denis offered — help them pick, do not restart welcome.";
    case "clarify_intent":
      return "Guest is answering drink vs food — map to menu, one gentle step.";
    case "confirm":
      return "Guest is answering order recap — natural affirmatives confirm; do not re-welcome.";
    case "serve_size":
    case "modifier":
      return "Guest is answering size/modifier — fill slot, do not re-ask.";
    default:
      return null;
  }
}

/** Unified conversation block for Situation Pack (replaces scattered thread + dialogue). */
export function buildConversationEvidence(
  model: ConversationModel | null | undefined
): string {
  if (!model || model.transcript.length === 0) return "";

  const lines = ["CONVERSATION CONTEXT (truth — continue this thread):"];

  if (model.summary) {
    lines.push(`- session_summary: ${model.summary}`);
  }

  lines.push(`- guest_turns: ${model.thread.guestTurns}`);
  lines.push(`- denis_turns: ${model.thread.denisTurns}`);

  if (model.thread.lastDenisText) {
    lines.push(`- last_denis_said: ${model.thread.lastDenisText.slice(0, 240)}`);
  }
  if (model.thread.lastGuestText) {
    lines.push(`- last_guest_said: ${model.thread.lastGuestText.slice(0, 240)}`);
  }

  if (model.awaiting) {
    lines.push(`- conversation.awaiting: ${model.awaiting}`);
    const instruction = awaitingInstruction(model.awaiting);
    if (instruction) {
      lines.push(`- instruction: ${instruction}`);
    }
  }

  if (model.thread.denisAskedQuestion) {
    lines.push(
      "- denis_awaiting_reply: yes — guest is answering your last question."
    );
  }

  if (model.attention.followUpDelaySeconds) {
    lines.push(
      `- guest_requested_follow_up_in: ${model.attention.followUpDelaySeconds}s`
    );
  }

  lines.push(
    "- instruction: Read transcript below as one dialogue — never reset to generic welcome mid-thread."
  );

  const transcriptMessages = model.transcript.map((entry) => ({
    role: entry.role === "guest" ? ("user" as const) : ("assistant" as const),
    content: entry.text,
  }));

  const transcriptBlock = retrieveTranscriptWindowEvidence(transcriptMessages);
  if (transcriptBlock) {
    lines.push("", transcriptBlock);
  }

  return lines.join("\n");
}
