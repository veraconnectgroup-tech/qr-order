"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  openVoiceAudioPipelineForEnvironment,
  type VoiceAudioPipeline,
} from "@/lib/denis/surfaces/voice/voice-audio-config";
import {
  createWakeWordDetector,
  type WakeWordDetector,
} from "@/lib/denis/surfaces/voice/wake-word-detector";

export type StationEarState =
  | "off"
  | "arming"
  | "listening"
  | "triggered"
  | "denied"
  | "unsupported";

/**
 * Pure arming decision — kept out of the effect so the "when does the ear
 * run at all" rule is directly unit-testable without browser audio APIs.
 */
export function shouldArmStationEar(input: {
  handsFreeEnabled: boolean;
  browserSupported: boolean;
  callActive: boolean;
}): boolean {
  return (
    input.handsFreeEnabled && input.browserSupported && !input.callActive
  );
}

export function isStationEarSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioContext !== "undefined"
  );
}

/**
 * ADR-053 P1 — the station's local "ear": kitchen/bar tablet keeps the
 * ADR-051 pipeline armed (industrial noise profile → wake-word energy
 * matcher) and fires onWakeWord when it hears "hej Denise". Everything
 * before the wake word is processed on-device only — no audio leaves the
 * tablet until the caller opens the Realtime session in response
 * (ADR-053 §4 privacy boundary). The caller disarms the ear while a call
 * is active by flipping `enabled` off; re-enabling re-arms a fresh
 * detector, so one wake word triggers exactly one call.
 */
export function useDenisStationEar(input: {
  enabled: boolean;
  onWakeWord: () => void;
}) {
  const [state, setState] = useState<StationEarState>("off");
  const pipelineRef = useRef<VoiceAudioPipeline | null>(null);
  const detectorRef = useRef<WakeWordDetector | null>(null);
  const onWakeWordRef = useRef(input.onWakeWord);
  onWakeWordRef.current = input.onWakeWord;

  const teardown = useCallback(() => {
    detectorRef.current?.teardown();
    detectorRef.current = null;
    pipelineRef.current?.teardown();
    pipelineRef.current = null;
  }, []);

  useEffect(() => {
    if (!input.enabled) {
      teardown();
      setState("off");
      return;
    }

    if (!isStationEarSupported()) {
      setState("unsupported");
      return;
    }

    let cancelled = false;
    setState("arming");

    void (async () => {
      try {
        // "kitchen" environment = industrial noise profile + wake-word
        // input mode (voice-audio-config.ts) — the loud-room regime this
        // ear exists for, on both kitchen and bar tablets.
        const pipeline = await openVoiceAudioPipelineForEnvironment("kitchen");
        if (cancelled || !pipeline) {
          pipeline?.teardown();
          if (!cancelled) setState("denied");
          return;
        }
        pipelineRef.current = pipeline;

        const detector = await createWakeWordDetector(pipeline.stream, {
          onWakeWordDetected: () => {
            setState("triggered");
            detectorRef.current?.pause();
            onWakeWordRef.current();
          },
        });
        if (cancelled || !detector) {
          teardown();
          if (!cancelled) setState("unsupported");
          return;
        }

        detectorRef.current = detector;
        detector.start();
        setState("listening");
      } catch {
        // getUserMedia rejection (permission denied / no mic) — stay
        // quiet; the click-to-talk button remains the fallback path.
        if (!cancelled) {
          teardown();
          setState("denied");
        }
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [input.enabled, teardown]);

  return { state };
}
