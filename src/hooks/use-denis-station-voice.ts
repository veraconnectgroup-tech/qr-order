"use client";

import { useCallback, useRef } from "react";
import { useSoundAlert } from "@/hooks/use-sound-alert";

/**
 * Denis speaking out loud at a kitchen/bar station — reuses the same
 * enabled/localStorage gate as the existing sound alerts (one shared
 * "enable sound" toggle, not a separate permission to grant).
 */
export function useDenisStationVoice(locationId: string) {
  const { enabled } = useSoundAlert();
  const playingRef = useRef(false);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text.trim() || playingRef.current) return;
      playingRef.current = true;

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
        });
    },
    [enabled, locationId]
  );

  return { voiceEnabled: enabled, speak };
}
