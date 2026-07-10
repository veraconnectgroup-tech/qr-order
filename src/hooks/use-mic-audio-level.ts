"use client";

import { useCallback, useRef, useState } from "react";

export type MicAudioLevelController = {
  /** Live analyser — callers read it every render frame (e.g. inside a
   *  WebGL loop) rather than subscribing to React state, since audio
   *  amplitude changes far too often for re-renders. */
  analyserRef: React.RefObject<AnalyserNode | null>;
  supported: boolean;
  active: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
};

/**
 * Opens the mic on demand (must be called from a user gesture — browsers
 * block getUserMedia otherwise) and exposes a live AnalyserNode for
 * real-time amplitude reads. This is the one place mic-amplitude access
 * should live — anything that needs to visually react to real speech
 * loudness (the voice orb, a waveform bar, a pulsing button) should read
 * from this, not fake it with a timer-driven animation.
 */
export function useMicAudioLevel(): MicAudioLevelController {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";

  const start = useCallback(async () => {
    if (!supported || active) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextCtor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) {
        setError("AudioContext not supported.");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const ctx = new AudioContextCtor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);

      streamRef.current = stream;
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access failed.");
    }
  }, [supported, active]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void ctxRef.current?.close();
    streamRef.current = null;
    ctxRef.current = null;
    analyserRef.current = null;
    setActive(false);
  }, []);

  return { analyserRef, supported, active, error, start, stop };
}
