import {
  detectGuestMessageLanguage,
  resolveAiPromptLanguage,
} from "@/lib/ai/config";

/** Infer reply/STT language from a voice transcript (multi-language guests). */
export function detectVoiceLanguage(
  transcript: string,
  menuLanguage: string,
  sessionLanguage?: string | null
): string {
  const venue = resolveAiPromptLanguage(menuLanguage);
  const detection = detectGuestMessageLanguage(transcript, menuLanguage);

  if (detection.confidence === "high" && detection.detected !== "unknown") {
    return detection.detected;
  }

  if (sessionLanguage) {
    return resolveAiPromptLanguage(sessionLanguage);
  }

  return venue;
}
