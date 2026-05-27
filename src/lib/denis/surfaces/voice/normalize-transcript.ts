/** T0 — collapse STT noise before kernel / legacy chat (M18). */
export function normalizeVoiceTranscript(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s.,!?]+|[\s.,!?]+$/g, "")
    .trim();
}
