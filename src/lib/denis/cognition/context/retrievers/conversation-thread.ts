import { extractBrowsingDeferredState } from "@/lib/denis/cognition/conversation/browsing-defer";
import type { TableSessionState } from "@/lib/denis/loop/types";

type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

const DENIS_QUESTION_PATTERN = /\?|da\s+li|jeste\s+li|have\s+you|haben\s+sie|möchten\s+sie/i;

function lastMessage(
  messages: TranscriptMessage[],
  role: TranscriptMessage["role"]
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const entry = messages[i];
    if (entry?.role !== role) continue;
    const text = entry.content.trim();
    if (text) return text;
  }
  return null;
}

/** Deterministic thread summary — helps LLM continue without resetting. */
export function buildConversationThreadEvidence(input: {
  transcript?: TranscriptMessage[];
  state?: TableSessionState | null;
}): string {
  const transcript = input.transcript ?? [];
  if (transcript.length === 0) return "";

  const guestTurns = transcript.filter((entry) => entry.role === "user").length;
  const denisTurns = transcript.filter(
    (entry) => entry.role === "assistant"
  ).length;
  const lastGuest = lastMessage(transcript, "user");
  const lastDenis = lastMessage(transcript, "assistant");
  const denisAwaitingReply =
    Boolean(lastDenis) && DENIS_QUESTION_PATTERN.test(lastDenis!);

  const browsing = input.state?.timeline
    ? extractBrowsingDeferredState(input.state.timeline)
    : null;

  const lines = [
    "CONVERSATION THREAD (continue naturally — this is the live dialogue):",
    `- guest_turns: ${guestTurns}`,
    `- denis_turns: ${denisTurns}`,
  ];

  if (lastDenis) {
    lines.push(`- last_denis_said: ${lastDenis.slice(0, 240)}`);
  }
  if (lastGuest) {
    lines.push(`- last_guest_said: ${lastGuest.slice(0, 240)}`);
  }
  if (denisAwaitingReply) {
    lines.push(
      "- denis_awaiting_reply: yes — guest is answering your last question; respond to THAT, do not open a new topic."
    );
  }
  if (browsing && browsing.deferCount > 0) {
    lines.push(
      `- guest_still_browsing: yes (${browsing.deferCount} defer signal${browsing.deferCount > 1 ? "s" : ""}) — stay patient, no menu push.`
    );
    if (browsing.followUpEmitted) {
      lines.push(
        "- browse_follow_up_sent: yes — you already checked back; if they defer again, keep it brief."
      );
    }
  }

  lines.push(
    "- instruction: Read the transcript below as one continuous conversation. Mirror the guest tone, reference what was just said, never repeat the same question twice."
  );

  return lines.join("\n");
}
