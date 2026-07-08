"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VenuePlaybookTone } from "@/lib/admin/generate-venue-playbook";
import { detectVoiceLanguage } from "@/lib/denis/surfaces/voice/detect-voice-language";
import {
  createVoiceActivityDetector,
  type VoiceActivityDetector,
} from "@/lib/denis/surfaces/voice/voice-activity-detector";
import {
  openVoiceAudioPipeline,
  openVoiceAudioPipelineForEnvironment,
  resolveVoiceAudioProfile,
  type VoiceAudioEnvironment,
  type VoiceAudioPipeline,
} from "@/lib/denis/surfaces/voice/voice-audio-config";
import {
  isVoiceTranscriptConfident,
  shouldRetryVoiceCapture,
} from "@/lib/denis/surfaces/voice/voice-confidence";
import { resolveVoiceTtsProfile } from "@/lib/denis/surfaces/voice/voice-tts-profile";
import {
  createWakeWordDetector,
  isWakePhraseMatch,
  stripWakePhrasePrefix,
  type WakeWordDetector,
} from "@/lib/denis/surfaces/voice/wake-word-detector";
import type { VoiceInputMode } from "@/lib/denis/stations/station-voice-context";

type BrowserSpeechRecognitionResult = {
  transcript?: string;
  confidence?: number;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult:
    | ((event: {
        results: {
          [index: number]: {
            [index: number]: BrowserSpeechRecognitionResult;
            isFinal?: boolean;
          };
        };
      }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export type VoiceCaptureResult =
  | {
      ok: true;
      transcript: string;
      confidence: number | null;
      detectedLanguage: string;
    }
  | {
      ok: false;
      reason: "low_confidence" | "no_speech" | "noise_gate" | "error";
      confidence?: number | null;
    };

export type UseDenisVoiceOptions = {
  enabled: boolean;
  language: string;
  menuLanguage: string;
  autoSpeak: boolean;
  playbookTone?: VenuePlaybookTone | null;
  /** Rate-limit key for the server TTS call — falls back to browser TTS without it. */
  sessionToken?: string | null;
  /** When true, VAD+STT arm only after local "Hej Denise" wake detection. */
  requireWakeWord?: boolean;
  /** Sala: omit. Station noisy fallback: push-to-talk. Overrides requireWakeWord when set. */
  inputMode?: VoiceInputMode;
  /** ADR-051 B1 — sala / kitchen / industrial selects pipeline + input mode together. */
  audioEnvironment?: VoiceAudioEnvironment;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapLocaleToSpeechTag(language: string): string {
  const base = language.trim().slice(0, 2).toLowerCase();
  if (base === "en") return "en-US";
  if (base === "de") return "de-DE";
  if (base === "sr") return "sr-RS";
  if (base === "hr") return "hr-HR";
  if (base === "fr") return "fr-FR";
  if (base === "es") return "es-ES";
  if (base === "it") return "it-IT";
  if (base === "tr") return "tr-TR";
  if (base === "ru") return "ru-RU";
  return language;
}

export function useDenisVoice({
  enabled,
  language,
  menuLanguage,
  autoSpeak,
  playbookTone = "friendly",
  sessionToken,
  requireWakeWord = false,
  inputMode,
  audioEnvironment,
}: UseDenisVoiceOptions) {
  const environmentProfile = audioEnvironment
    ? resolveVoiceAudioProfile(audioEnvironment)
    : null;
  const resolvedInputMode = environmentProfile?.inputMode ?? inputMode;
  const pushToTalkMode = resolvedInputMode === "push-to-talk";
  const effectiveRequireWakeWord =
    !pushToTalkMode &&
    (requireWakeWord ||
      resolvedInputMode === "wake-word" ||
      audioEnvironment === "sala" ||
      audioEnvironment === "kitchen");
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioPipelineRef = useRef<VoiceAudioPipeline | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const wakeWordRef = useRef<WakeWordDetector | null>(null);
  const sttStartedRef = useRef(false);
  const onResultRef = useRef<((result: VoiceCaptureResult) => void) | null>(
    null
  );
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor() && enabled);
  }, [enabled]);

  const teardownAudioPipeline = useCallback(() => {
    vadRef.current?.teardown();
    vadRef.current = null;
    wakeWordRef.current?.teardown();
    wakeWordRef.current = null;
    audioPipelineRef.current?.teardown();
    audioPipelineRef.current = null;
    sttStartedRef.current = false;
  }, []);

  const stopListening = useCallback((options?: { silent?: boolean }) => {
    const hadConfirmedSpeech = vadRef.current?.hasConfirmedSpeech() ?? false;
    const hadWakeWord = wakeWordRef.current?.hasDetectedWakeWord() ?? false;
    const sttWasStarted = sttStartedRef.current;

    if (sttWasStarted && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    recognitionRef.current = null;
    vadRef.current?.pause();
    wakeWordRef.current?.pause();
    teardownAudioPipeline();
    setListening(false);

    if (
      !options?.silent &&
      !hadConfirmedSpeech &&
      !hadWakeWord &&
      onResultRef.current
    ) {
      onResultRef.current({ ok: false, reason: "no_speech" });
      onResultRef.current = null;
    }
  }, [teardownAudioPipeline]);

  const speakWithBrowserVoice = useCallback(
    (text: string, speakLanguage?: string) => {
      if (typeof window === "undefined") return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = mapLocaleToSpeechTag(speakLanguage ?? language);
      const profile = resolveVoiceTtsProfile(playbookTone);
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      window.speechSynthesis.speak(utterance);
    },
    [language, playbookTone]
  );

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback(
    (text: string, speakLanguage?: string) => {
      if (!autoSpeak || typeof window === "undefined" || !text.trim()) {
        return;
      }
      stopPlayback();

      if (!sessionToken) {
        speakWithBrowserVoice(text, speakLanguage);
        return;
      }

      fetch("/api/ai/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), sessionToken }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("tts_failed");
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          playbackRef.current = audio;
          audio.addEventListener("ended", () => URL.revokeObjectURL(url));
          audio.addEventListener("error", () => URL.revokeObjectURL(url));
          await audio.play();
        })
        .catch(() => {
          // Brand voice unavailable — fall back to the device's own TTS
          // rather than leaving the guest with no spoken reply at all.
          speakWithBrowserVoice(text, speakLanguage);
        });
    },
    [autoSpeak, sessionToken, speakWithBrowserVoice, stopPlayback]
  );

  const startListening = useCallback(
    (onResult: (result: VoiceCaptureResult) => void) => {
      if (!enabled || !supported) {
        onResult({ ok: false, reason: "error" });
        return false;
      }

      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        onResult({ ok: false, reason: "error" });
        return false;
      }

      stopListening({ silent: true });
      onResultRef.current = onResult;
      sttStartedRef.current = false;

      const recognition = new Ctor();
      recognition.lang = mapLocaleToSpeechTag(language);
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.continuous = false;

      const startSttIfNeeded = () => {
        if (sttStartedRef.current || !recognitionRef.current) return;
        if (effectiveRequireWakeWord && !wakeWordRef.current?.hasDetectedWakeWord()) {
          return;
        }
        sttStartedRef.current = true;
        try {
          recognitionRef.current.start();
        } catch {
          /* already active */
        }
      };

      const armCommandCapture = async (pipeline: VoiceAudioPipeline) => {
        if (!recognitionRef.current) return;

        const vad = await createVoiceActivityDetector(pipeline.stream, {
          onSpeechStart: startSttIfNeeded,
          onSpeechEnd: () => {
            if (sttStartedRef.current) {
              recognitionRef.current?.stop();
            }
          },
        });

        if (!recognitionRef.current) return;

        if (vad) {
          vadRef.current = vad;
          vad.start();
          return;
        }

        startSttIfNeeded();
      };

      recognition.onresult = (event) => {
        const results = event.results as SpeechRecognitionResultList;
        const lastIndex = results.length - 1;
        const result = results[lastIndex];
        if (!result?.isFinal) return;

        let transcript = result[0]?.transcript?.trim() ?? "";
        const confidence = result[0]?.confidence ?? null;

        if (!transcript) {
          onResultRef.current?.({ ok: false, reason: "no_speech", confidence });
          return;
        }

        if (effectiveRequireWakeWord) {
          const wakeConfirmed =
            wakeWordRef.current?.hasDetectedWakeWord() ||
            isWakePhraseMatch(transcript);
          if (!wakeConfirmed) {
            onResultRef.current?.({
              ok: false,
              reason: "noise_gate",
              confidence,
            });
            return;
          }
          transcript = stripWakePhrasePrefix(transcript);
          if (!transcript) {
            onResultRef.current?.({ ok: false, reason: "no_speech", confidence });
            return;
          }
        }

        if (!vadRef.current?.hasConfirmedSpeech() && !effectiveRequireWakeWord && !pushToTalkMode) {
          onResultRef.current?.({
            ok: false,
            reason: "noise_gate",
            confidence,
          });
          return;
        }

        if (shouldRetryVoiceCapture(confidence)) {
          onResultRef.current?.({
            ok: false,
            reason: "low_confidence",
            confidence,
          });
          return;
        }

        const detectedLanguage = detectVoiceLanguage(
          transcript,
          menuLanguage,
          language
        );

        onResultRef.current?.({
          ok: true,
          transcript,
          confidence,
          detectedLanguage,
        });
        onResultRef.current = null;
      };

      recognition.onerror = () => {
        setListening(false);
        recognitionRef.current = null;
        teardownAudioPipeline();
        onResultRef.current?.({ ok: false, reason: "error" });
        onResultRef.current = null;
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
        teardownAudioPipeline();
      };

      recognitionRef.current = recognition;
      setListening(true);

      void (audioEnvironment
        ? openVoiceAudioPipelineForEnvironment(audioEnvironment)
        : openVoiceAudioPipeline()
      )
        .then(async (pipeline) => {
          if (!pipeline || !recognitionRef.current) return;
          audioPipelineRef.current = pipeline;

          if (effectiveRequireWakeWord) {
            const wake = await createWakeWordDetector(pipeline.stream, {
              onWakeWordDetected: () => {
                void armCommandCapture(pipeline);
              },
            });

            if (!recognitionRef.current) return;

            if (wake) {
              wakeWordRef.current = wake;
              wake.start();
              return;
            }
          }

          await armCommandCapture(pipeline);
        })
        .catch(() => {
          if (recognitionRef.current) {
            startSttIfNeeded();
          }
        });

      return true;
    },
    [
      enabled,
      supported,
      language,
      menuLanguage,
      requireWakeWord,
      inputMode,
      audioEnvironment,
      pushToTalkMode,
      effectiveRequireWakeWord,
      stopListening,
      teardownAudioPipeline,
    ]
  );

  useEffect(() => {
    return () => {
      stopListening();
      stopPlayback();
    };
  }, [stopListening, stopPlayback]);

  return {
    supported,
    listening,
    startListening,
    stopListening,
    speak,
    isVoiceTranscriptConfident,
    pushToTalkMode,
    audioEnvironment: audioEnvironment ?? null,
  };
}
