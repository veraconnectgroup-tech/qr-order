"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSoundAlert } from "@/hooks/use-sound-alert";

const ACTIVATION_LINE = "Denis je spreman.";
const LISTEN_TIMEOUT_MS = 8000;
// The mic permission prompt can take longer than LISTEN_TIMEOUT_MS to
// resolve the first time a browser ever asks (user has to notice and click
// Allow) — this hard cap only exists to stop a recognizer that never
// reports onstart at all, so it's intentionally generous.
const LISTEN_HARD_CAP_MS = 20000;

type BrowserSpeechRecognitionResult = { transcript?: string };

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
          length: number;
        };
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Denis speaking out loud at a kitchen/bar station — reuses the same
 * enabled/localStorage gate as the existing sound alerts (one shared
 * "enable sound" toggle, not a separate permission to grant), plus an
 * explicit one-tap "Activate Denis" gesture. Browsers only allow audio
 * playback that traces back to a real click; a speak() call fired later
 * from a background effect (no click involved) can silently fail to
 * play even when the fetch itself succeeds, so `primed` tracks whether
 * this tab has had that one unlocking click yet.
 *
 * Also opens a short listen window right after Denis finishes speaking a
 * question, so staff can just answer out loud (walkie-talkie style)
 * instead of needing to tap a button.
 */
export function useDenisStationVoice(locationId: string) {
  const { enabled, enable } = useSoundAlert();
  const playingRef = useRef(false);
  const [primed, setPrimed] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopListening = useCallback(() => {
    if (listenTimeoutRef.current != null) {
      clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = null;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  /** One-shot listen window — meant to fire right after Denis asks something. */
  const listen = useCallback(
    (onResult: (transcript: string) => void) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        console.warn(
          "[denis-station-voice] SpeechRecognition unsupported in this browser"
        );
        return;
      }
      stopListening();

      const recognition = new Ctor();
      recognition.lang = "sr-RS";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      let settled = false;
      const finish = (transcript: string) => {
        if (settled) return;
        settled = true;
        stopListening();
        onResult(transcript);
      };

      recognition.onresult = (event) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex]?.[0]?.transcript?.trim() ?? "";
        finish(transcript);
      };
      recognition.onerror = (event) => {
        console.error(
          "[denis-station-voice] listen failed",
          event?.error ?? "unknown"
        );
        finish("");
      };
      recognition.onend = () => finish("");
      // Only start the real listen window once recognition has actually
      // begun capturing — calling start() merely requests the mic; on a
      // fresh permission prompt the browser can sit waiting on the user for
      // several seconds before onstart fires, and stopping on a fixed timer
      // from start() alone would abort the very first listen attempt on
      // every device before the person ever gets to speak.
      recognition.onstart = () => {
        if (listenTimeoutRef.current != null) {
          clearTimeout(listenTimeoutRef.current);
        }
        listenTimeoutRef.current = setTimeout(() => {
          recognition.stop();
        }, LISTEN_TIMEOUT_MS);
      };

      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
      listenTimeoutRef.current = setTimeout(() => {
        recognition.stop();
      }, LISTEN_HARD_CAP_MS);
    },
    [stopListening]
  );

  const playText = useCallback(
    (text: string, onEnded?: () => void) => {
      if (!text.trim() || playingRef.current) return;
      playingRef.current = true;
      setSpeaking(true);

      fetch("/api/ai/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), sessionToken: locationId }),
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`tts_failed (${res.status})`);
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          // Wait for playback to actually finish (not just start) so
          // `speaking` — and any listen-after-speak callback — reflect
          // real speech duration instead of firing the instant play() begins.
          await new Promise<void>((resolve) => {
            audio.addEventListener("ended", () => {
              URL.revokeObjectURL(url);
              resolve();
            });
            audio.addEventListener("error", () => {
              URL.revokeObjectURL(url);
              resolve();
            });
            audio.play().catch(() => resolve());
          });
        })
        .catch((error) => {
          // The visible question card + color already carry the message —
          // voice is a bonus, not the only channel — so this stays non-fatal.
          // Logged (not silent) so a recurring failure is diagnosable from
          // the station device's console instead of guessing blind.
          console.error("[denis-station-voice] speak failed", error);
        })
        .finally(() => {
          playingRef.current = false;
          setSpeaking(false);
          onEnded?.();
        });
    },
    [locationId]
  );

  const speak = useCallback(
    (text: string, onEnded?: () => void) => {
      if (!enabled || !primed) return;
      playText(text, onEnded);
    },
    [enabled, primed, playText]
  );

  // Station screens navigate/re-render (new question arrives, staff switches
  // tabs) — don't leave a stray recognizer running or its timeout firing
  // against an unmounted component.
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  /** Explicit user tap — unlocks audio playback for this tab and turns on sound. */
  const activate = useCallback(() => {
    enable();
    setPrimed(true);
    playText(ACTIVATION_LINE);
  }, [enable, playText]);

  return {
    voiceEnabled: enabled,
    voicePrimed: primed,
    speaking,
    listening,
    speak,
    activate,
    listen,
    stopListening,
  };
}
