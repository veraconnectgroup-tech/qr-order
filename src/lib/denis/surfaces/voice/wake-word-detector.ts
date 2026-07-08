import {
  extractVoiceActivityFrame,
  VoiceActivityStateMachine,
} from "@/lib/denis/surfaces/voice/voice-activity-detector";
import {
  VOICE_HIGHPASS_HZ,
  VOICE_LOWPASS_HZ,
} from "@/lib/denis/surfaces/voice/voice-audio-config";

export const DENIS_WAKE_PHRASE = "hej denise";

export const WAKE_PHRASE_ALIASES = [
  DENIS_WAKE_PHRASE,
  "hey denise",
  "hej denis",
  "ej denise",
  "hei denise",
  "hey denis",
] as const;

/** Syllable energy contour for "hej-de-ni-se" — local template, no STT. */
export const WAKE_WORD_ENERGY_TEMPLATE = [
  0.25, 0.95, 0.35, 0.45, 0.85, 0.95, 0.88, 0.75, 0.55, 0.3,
];

export const WAKE_WORD_ACOUSTIC_MATCH_THRESHOLD = 0.62;

export const WAKE_WORD_MIN_ENVELOPE_FRAMES = 6;

export type WakeWordCallbacks = {
  onWakeWordDetected?: () => void;
};

export type WakeWordDetector = {
  start: () => void;
  pause: () => void;
  hasDetectedWakeWord: () => boolean;
  reset: () => void;
  teardown: () => void;
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalizeWakeTranscript(raw: string): string {
  return stripDiacritics(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isWakePhraseMatch(
  transcript: string,
  phrases: readonly string[] = WAKE_PHRASE_ALIASES
): boolean {
  const normalized = normalizeWakeTranscript(transcript);
  if (!normalized) return false;

  return phrases.some((phrase) => {
    const target = normalizeWakeTranscript(phrase);
    return (
      normalized === target ||
      normalized.startsWith(`${target} `) ||
      normalized.includes(` ${target} `) ||
      normalized.endsWith(` ${target}`)
    );
  });
}

export function stripWakePhrasePrefix(transcript: string): string {
  const normalized = normalizeWakeTranscript(transcript);
  if (!normalized) return transcript.trim();

  for (const phrase of WAKE_PHRASE_ALIASES) {
    const target = normalizeWakeTranscript(phrase);
    if (normalized === target) return "";
    if (normalized.startsWith(`${target} `)) {
      const rawLower = transcript.toLowerCase();
      const index = rawLower.indexOf(phrase);
      if (index >= 0) {
        return transcript.slice(index + phrase.length).trim();
      }
      return normalized.slice(target.length).trim();
    }
  }

  return transcript.trim();
}

export function computeEnergyEnvelope(frames: number[]): number[] {
  if (frames.length === 0) return [];
  const peak = Math.max(...frames, 0.001);
  return frames.map((value) => value / peak);
}

function resampleEnvelope(envelope: number[], targetLength: number): number[] {
  if (envelope.length === 0 || targetLength <= 0) return [];
  if (envelope.length === targetLength) return envelope;

  const resampled = new Array<number>(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const position = (i / (targetLength - 1)) * (envelope.length - 1);
    const left = Math.floor(position);
    const right = Math.min(envelope.length - 1, Math.ceil(position));
    const weight = position - left;
    resampled[i] =
      envelope[left]! * (1 - weight) + envelope[right]! * weight;
  }
  return resampled;
}

export function scoreWakeWordEnergyMatch(
  envelope: number[],
  template: number[] = WAKE_WORD_ENERGY_TEMPLATE
): number {
  if (envelope.length < WAKE_WORD_MIN_ENVELOPE_FRAMES || template.length === 0) {
    return 0;
  }

  const normalized = computeEnergyEnvelope(envelope);
  const aligned = resampleEnvelope(normalized, template.length);
  if (aligned.length === 0) return 0;

  const templateMean =
    template.reduce((sum, value) => sum + value, 0) / template.length;
  const alignedMean =
    aligned.reduce((sum, value) => sum + value, 0) / aligned.length;

  let numerator = 0;
  let templateVar = 0;
  let alignedVar = 0;

  for (let i = 0; i < template.length; i++) {
    const t = template[i]! - templateMean;
    const a = aligned[i]! - alignedMean;
    numerator += t * a;
    templateVar += t * t;
    alignedVar += a * a;
  }

  if (templateVar === 0 || alignedVar === 0) return 0;
  const correlation = numerator / Math.sqrt(templateVar * alignedVar);
  return Math.max(0, Math.min(1, (correlation + 1) / 2));
}

export function isWakeWordAcousticMatch(
  envelope: number[],
  threshold: number = WAKE_WORD_ACOUSTIC_MATCH_THRESHOLD
): boolean {
  return scoreWakeWordEnergyMatch(envelope) >= threshold;
}

function createEnergyWakeWordDetector(
  stream: MediaStream,
  callbacks: WakeWordCallbacks
): WakeWordDetector | null {
  if (typeof window === "undefined") return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return null;

  const ctx = new AudioContextCtor();
  const source = ctx.createMediaStreamSource(stream);

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = VOICE_HIGHPASS_HZ;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = VOICE_LOWPASS_HZ;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(analyser);

  const stateMachine = new VoiceActivityStateMachine();
  const samples = new Float32Array(analyser.fftSize);
  const envelopeFrames: number[] = [];
  let detected = false;
  let rafId: number | null = null;
  let running = false;

  const tick = () => {
    if (!running) return;

    analyser.getFloatTimeDomainData(samples);
    const frame = extractVoiceActivityFrame(samples);
    const transition = stateMachine.processFrame(frame, performance.now());

    if (stateMachine.isSpeechActive()) {
      envelopeFrames.push(frame.rms);
      if (envelopeFrames.length > 24) {
        envelopeFrames.shift();
      }
    }

    if (
      transition.speechEnded &&
      envelopeFrames.length >= WAKE_WORD_MIN_ENVELOPE_FRAMES &&
      !detected
    ) {
      if (isWakeWordAcousticMatch(envelopeFrames)) {
        detected = true;
        callbacks.onWakeWordDetected?.();
      }
      envelopeFrames.length = 0;
    }

    if (transition.speechStarted) {
      envelopeFrames.length = 0;
    }

    rafId = window.requestAnimationFrame(tick);
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      void ctx.resume();
      rafId = window.requestAnimationFrame(tick);
    },
    pause: () => {
      running = false;
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    hasDetectedWakeWord: () => detected,
    reset: () => {
      detected = false;
      envelopeFrames.length = 0;
      stateMachine.reset();
    },
    teardown: () => {
      running = false;
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      source.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      analyser.disconnect();
      void ctx.close();
      detected = false;
      envelopeFrames.length = 0;
      stateMachine.reset();
    },
  };
}

/** Local wake-word listener on the shared mic stream — no command STT until detected. */
export async function createWakeWordDetector(
  stream: MediaStream,
  callbacks: WakeWordCallbacks = {}
): Promise<WakeWordDetector | null> {
  return createEnergyWakeWordDetector(stream, callbacks);
}
