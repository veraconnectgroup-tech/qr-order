type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

/** `transcript.window` — last N turns for perceive prompt. */
export function retrieveTranscriptWindowEvidence(
  messages: TranscriptMessage[],
  maxTurns = 8
): string {
  if (!messages.length) return "";

  const window = messages.slice(-maxTurns * 2);
  const lines = window.map(
    (entry) => `${entry.role === "user" ? "Guest" : "Denis"}: ${entry.content}`
  );

  return `RECENT TRANSCRIPT:\n${lines.join("\n")}`;
}
