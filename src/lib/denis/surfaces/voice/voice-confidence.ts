/** Minimum browser STT confidence before accepting a voice turn (restaurant noise). */
export const VOICE_STT_MIN_CONFIDENCE = 0.7;

export function isVoiceTranscriptConfident(
  confidence: number | undefined | null
): boolean {
  if (confidence == null || Number.isNaN(confidence)) {
    // Safari / some engines omit confidence — accept transcript.
    return true;
  }
  return confidence >= VOICE_STT_MIN_CONFIDENCE;
}

export function shouldRetryVoiceCapture(
  confidence: number | undefined | null
): boolean {
  return !isVoiceTranscriptConfident(confidence);
}
