"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { speakWithBrowserVoice } from "@/lib/denis/surfaces/voice/speak-with-browser-voice";

const ACTIVATION_LINE = "Denis je spreman.";

/**
 * How pressured the moment is — shades TTS delivery without changing
 * Denis's voice identity (see denis-voice-instructions.ts). `station`, when
 * set, tells the server this is a station-voice call so it recomputes
 * venueChaosRatio from real order backlog instead of trusting the client's
 * number (see resolve-station-voice-snapshot.ts).
 */
export type DenisVoiceTone = {
  urgencyRatio?: number;
  venueChaosRatio?: number;
  station?: "kitchen" | "bar";
};

const TTS_MIME_TYPE = "audio/mpeg";

function canStreamViaMediaSource(): boolean {
  return (
    typeof MediaSource !== "undefined" &&
    MediaSource.isTypeSupported(TTS_MIME_TYPE)
  );
}

/**
 * Progressive playback — starts speaking as soon as the first audio chunk
 * arrives instead of waiting for the whole file to download. Any failure
 * here just resolves quietly (same "Denis stops gracefully" behavior as
 * the blob fallback) rather than retrying, since the stream is already
 * partially consumed at that point.
 */
function playViaMediaSource(body: ReadableStream<Uint8Array>): Promise<void> {
  const mediaSource = new MediaSource();
  const url = URL.createObjectURL(mediaSource);
  const audio = new Audio(url);

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve();
    };

    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);

    mediaSource.addEventListener(
      "sourceopen",
      () => {
        let sourceBuffer: SourceBuffer;
        try {
          sourceBuffer = mediaSource.addSourceBuffer(TTS_MIME_TYPE);
        } catch {
          finish();
          return;
        }

        const reader = body.getReader();

        const pump = (): void => {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                if (mediaSource.readyState === "open") {
                  mediaSource.endOfStream();
                }
                return;
              }
              if (!value) {
                pump();
                return;
              }
              sourceBuffer.appendBuffer(value as BufferSource);
            })
            .catch(finish);
        };

        sourceBuffer.addEventListener("updateend", pump);
        pump();
      },
      { once: true }
    );

    audio.play().catch(() => {
      // Queued playback resumes once appendBuffer feeds the first chunk —
      // an immediate rejection here is expected before data exists yet.
    });
  });
}

/** Full-download path — used whenever MediaSource/mp3 streaming isn't supported. */
async function playViaBlob(res: Response): Promise<void> {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
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
}

const LISTEN_TIMEOUT_MS = 12000;
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

/** Expected STT errors when we stop the mic ourselves — not worth console.error. */
function isBenignListenError(code: string | undefined): boolean {
  return code === "aborted" || code === "no-speech";
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
        const code = event?.error ?? "unknown";
        if (!isBenignListenError(code)) {
          console.warn("[denis-station-voice] listen failed", code);
        }
        finish("");
      };
      recognition.onend = () => {
        if (!settled) finish("");
      };
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
    (text: string, onEnded?: () => void, tone?: DenisVoiceTone) => {
      if (!text.trim() || playingRef.current) return;
      playingRef.current = true;
      setSpeaking(true);

      const trimmed = text.trim();

      const playServerTts = fetch("/api/ai/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          sessionToken: locationId,
          urgencyRatio: tone?.urgencyRatio,
          venueChaosRatio: tone?.venueChaosRatio,
          station: tone?.station,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`tts_failed (${res.status})`);
          }
          if (res.body && canStreamViaMediaSource()) {
            await playViaMediaSource(res.body);
          } else {
            await playViaBlob(res);
          }
        });

      void playServerTts
        .catch(async (error) => {
          // OpenAI TTS often 502 locally without key — browser voice keeps Denis talking.
          console.warn(
            "[denis-station-voice] server TTS unavailable, using browser voice",
            error instanceof Error ? error.message : error
          );
          await speakWithBrowserVoice(trimmed);
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
    (text: string, onEnded?: () => void, tone?: DenisVoiceTone): boolean => {
      if (!enabled || !primed || playingRef.current) return false;
      playText(text, onEnded, tone);
      return true;
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
