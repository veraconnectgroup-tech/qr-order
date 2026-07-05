"use client";

import { useCallback, useRef, useState } from "react";
import { useSoundAlert } from "@/hooks/use-sound-alert";

const ACTIVATION_LINE = "Denis je spreman.";

/**
 * Denis speaking out loud at a kitchen/bar station — reuses the same
 * enabled/localStorage gate as the existing sound alerts (one shared
 * "enable sound" toggle, not a separate permission to grant), plus an
 * explicit one-tap "Activate Denis" gesture. Browsers only allow audio
 * playback that traces back to a real click; a speak() call fired later
 * from a background effect (no click involved) can silently fail to
 * play even when the fetch itself succeeds, so `primed` tracks whether
 * this tab has had that one unlocking click yet.
 */
export function useDenisStationVoice(locationId: string) {
  const { enabled, enable } = useSoundAlert();
  const playingRef = useRef(false);
  const [primed, setPrimed] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const playText = useCallback(
    (text: string) => {
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
          audio.addEventListener("ended", () => URL.revokeObjectURL(url));
          audio.addEventListener("error", () => URL.revokeObjectURL(url));
          await audio.play();
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
        });
    },
    [locationId]
  );

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !primed) return;
      playText(text);
    },
    [enabled, primed, playText]
  );

  /** Explicit user tap — unlocks audio playback for this tab and turns on sound. */
  const activate = useCallback(() => {
    enable();
    setPrimed(true);
    playText(ACTIVATION_LINE);
  }, [enable, playText]);

  return { voiceEnabled: enabled, voicePrimed: primed, speaking, speak, activate };
}
