import { resolveVoiceTtsProfile } from "@/lib/denis/surfaces/voice/voice-tts-profile";

function loadSpeechSynthesisVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined") return Promise.resolve([]);

  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const finish = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish);
    window.setTimeout(finish, 300);
  });
}

/** Prefer a real Serbian voice — default English TTS on sr-RS sounds like a bad accent. */
function pickVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice | null {
  const base = lang.trim().slice(0, 2).toLowerCase();
  const fallbacks =
    base === "sr" ? ["sr", "hr", "bs"] : [base];

  const scoreVoice = (voice: SpeechSynthesisVoice, code: string): number => {
    const vlang = voice.lang.toLowerCase();
    const name = voice.name.toLowerCase();
    let score = 0;
    if (vlang.startsWith(code)) score += 12;
    if (vlang.includes(`${code}-`)) score += 4;
    if (code === "sr" && /serb|srpski|milena|lana|sr/i.test(name)) score += 6;
    if (voice.localService) score += 2;
    return score;
  };

  let best: { voice: SpeechSynthesisVoice; score: number } | null = null;
  for (const code of fallbacks) {
    for (const voice of voices) {
      const score = scoreVoice(voice, code);
      if (score > 0 && (!best || score > best.score)) {
        best = { voice, score };
      }
    }
    if (best && best.score >= 12) break;
  }

  return best?.voice ?? null;
}

/** Device TTS fallback when OpenAI brand voice is unavailable. */
export async function speakWithBrowserVoice(
  text: string,
  lang = "sr-RS"
): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;

  const voices = await loadSpeechSynthesisVoices();
  const voice = pickVoiceForLanguage(voices, lang);
  const profile = resolveVoiceTtsProfile("friendly");

  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = voice?.lang ?? lang;
    if (voice) utterance.voice = voice;
    utterance.rate = Math.min(profile.rate, 0.95);
    utterance.pitch = profile.pitch;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
