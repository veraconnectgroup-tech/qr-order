"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VenuePlaybookTone } from "@/lib/admin/generate-venue-playbook";
import { detectVoiceLanguage } from "@/lib/denis/surfaces/voice/detect-voice-language";
import {
  isSignalAboveNoiseGate,
  openVoiceAudioPipeline,
  type VoiceAudioPipeline,
} from "@/lib/denis/surfaces/voice/voice-audio-config";
import {
  isVoiceTranscriptConfident,
  shouldRetryVoiceCapture,
} from "@/lib/denis/surfaces/voice/voice-confidence";
import { resolveVoiceTtsProfile } from "@/lib/denis/surfaces/voice/voice-tts-profile";

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
}: UseDenisVoiceOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioPipelineRef = useRef<VoiceAudioPipeline | null>(null);
  const onResultRef = useRef<((result: VoiceCaptureResult) => void) | null>(
    null
  );
  const peakSignalRef = useRef(0);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor() && enabled);
  }, [enabled]);

  const teardownAudioPipeline = useCallback(() => {
    audioPipelineRef.current?.teardown();
    audioPipelineRef.current = null;
    peakSignalRef.current = 0;
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    teardownAudioPipeline();
    setListening(false);
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

      stopListening();
      onResultRef.current = onResult;
      peakSignalRef.current = 0;

      void openVoiceAudioPipeline()
        .then((pipeline) => {
          if (pipeline) {
            audioPipelineRef.current = pipeline;
          }
        })
        .catch(() => {
          /* STT still works without parallel metering */
        });

      const recognition = new Ctor();
      recognition.lang = mapLocaleToSpeechTag(language);
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        const pipeline = audioPipelineRef.current;
        if (pipeline) {
          const level = pipeline.getSignalLevel();
          if (level > peakSignalRef.current) {
            peakSignalRef.current = level;
          }
        }

        const results = event.results as SpeechRecognitionResultList;
        const lastIndex = results.length - 1;
        const result = results[lastIndex];
        if (!result?.isFinal) return;

        const transcript = result[0]?.transcript?.trim() ?? "";
        const confidence = result[0]?.confidence ?? null;

        if (!transcript) {
          onResultRef.current?.({ ok: false, reason: "no_speech", confidence });
          return;
        }

        if (
          pipeline &&
          peakSignalRef.current > 0 &&
          !isSignalAboveNoiseGate(peakSignalRef.current)
        ) {
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
      };

      recognition.onerror = () => {
        setListening(false);
        recognitionRef.current = null;
        teardownAudioPipeline();
        onResultRef.current?.({ ok: false, reason: "error" });
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
        teardownAudioPipeline();
      };

      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
      return true;
    },
    [enabled, supported, language, menuLanguage, stopListening, teardownAudioPipeline]
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
  };
}
