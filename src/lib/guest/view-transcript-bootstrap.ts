import type { TranscriptEntry } from "@/lib/denis/loop/view-types";

export type ViewBootstrapChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/** Map Denis view transcript → chat desk messages (Phase B.1). */
export function transcriptEntriesToChatMessages(
  transcript: TranscriptEntry[]
): ViewBootstrapChatMessage[] {
  return transcript.map((entry) => ({
    id: entry.id,
    role: entry.role === "guest" ? "user" : "assistant",
    content: entry.text,
  }));
}
