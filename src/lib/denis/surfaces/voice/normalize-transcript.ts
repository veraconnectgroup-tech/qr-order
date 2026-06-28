const VOICE_COMMAND_PREFIX =
  /^(?:daj mi|molim te|može|moze|bitte|please|can i have|i want|ich möchte|ich moechte|bring mir|bring me)\s+/i;

/** T0 — collapse STT noise before kernel / legacy chat (M18). */
export function normalizeVoiceTranscript(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(VOICE_COMMAND_PREFIX, "")
    .replace(/^[\s.,!?]+|[\s.,!?]+$/g, "")
    .trim();
}
