import {
  VOICE_HIGHPASS_HZ,
  VOICE_LOWPASS_HZ,
} from "@/lib/denis/surfaces/voice/voice-audio-config";

/** Minimum voiced segment length before we treat it as speech (not a transient clink). */
export const VAD_MIN_SPEECH_MS = 120;

/** Hangover after energy drops — keeps STT open through short pauses between words. */
export const VAD_HANGOVER_MS = 350;

/** Energy must exceed adaptive noise floor by this factor to enter speech. */
export const VAD_ENERGY_START_RATIO = 2.5;

/** Lower ratio to exit speech once hangover elapses. */
export const VAD_ENERGY_END_RATIO = 1.6;

/** Zero-crossing band that rejects steady hum/hiss while accepting voiced speech. */
export const VAD_MIN_ZCR = 0.015;
export const VAD_MAX_ZCR = 0.5;

/** EMA smoothing for ambient noise floor estimation. */
export const VAD_NOISE_FLOOR_ALPHA = 0.03;

export type VoiceActivityFrame = {
  rms: number;
  zcr: number;
};

export type VoiceActivityState = "idle" | "speech" | "hangover";

export type VoiceActivityTransition = {
  state: VoiceActivityState;
  speechStarted: boolean;
  speechEnded: boolean;
};

export type VoiceActivityCallbacks = {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
};

export type VoiceActivityDetector = {
  start: () => void;
  pause: () => void;
  isSpeechActive: () => boolean;
  hasConfirmedSpeech: () => boolean;
  teardown: () => void;
};

export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]!;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

export function computeZeroCrossingRate(samples: Float32Array): number {
  if (samples.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!;
    const curr = samples[i]!;
    if ((curr >= 0 && prev < 0) || (curr < 0 && prev >= 0)) {
      crossings++;
    }
  }
  return crossings / (samples.length - 1);
}

export function extractVoiceActivityFrame(samples: Float32Array): VoiceActivityFrame {
  return {
    rms: computeRms(samples),
    zcr: computeZeroCrossingRate(samples),
  };
}

function isSpeechLikeFrame(
  frame: VoiceActivityFrame,
  noiseFloor: number,
  startRatio: number
): boolean {
  const energyRatio = frame.rms / Math.max(noiseFloor, 0.001);
  const zcrInBand = frame.zcr >= VAD_MIN_ZCR && frame.zcr <= VAD_MAX_ZCR;
  return energyRatio >= startRatio && zcrInBand;
}

function isSpeechSustainedFrame(
  frame: VoiceActivityFrame,
  noiseFloor: number,
  endRatio: number
): boolean {
  const energyRatio = frame.rms / Math.max(noiseFloor, 0.001);
  const zcrInBand = frame.zcr >= VAD_MIN_ZCR && frame.zcr <= VAD_MAX_ZCR;
  return energyRatio >= endRatio && zcrInBand;
}

export class VoiceActivityStateMachine {
  private state: VoiceActivityState = "idle";
  private noiseFloor = 0.01;
  private speechStartMs = 0;
  private lastVoicedMs = 0;
  private confirmedSpeech = false;

  reset(): void {
    this.state = "idle";
    this.noiseFloor = 0.01;
    this.speechStartMs = 0;
    this.lastVoicedMs = 0;
    this.confirmedSpeech = false;
  }

  getState(): VoiceActivityState {
    return this.state;
  }

  hasConfirmedSpeech(): boolean {
    return this.confirmedSpeech;
  }

  isSpeechActive(): boolean {
    return this.state === "speech" || this.state === "hangover";
  }

  processFrame(frame: VoiceActivityFrame, nowMs: number): VoiceActivityTransition {
    if (this.state === "idle") {
      this.noiseFloor =
        this.noiseFloor * (1 - VAD_NOISE_FLOOR_ALPHA) +
        frame.rms * VAD_NOISE_FLOOR_ALPHA;
    }

    const speechLike = isSpeechLikeFrame(
      frame,
      this.noiseFloor,
      VAD_ENERGY_START_RATIO
    );
    const speechSustained = isSpeechSustainedFrame(
      frame,
      this.noiseFloor,
      VAD_ENERGY_END_RATIO
    );

    let speechStarted = false;
    let speechEnded = false;

    if (this.state === "idle") {
      if (speechLike) {
        this.state = "speech";
        this.speechStartMs = nowMs;
        this.lastVoicedMs = nowMs;
        this.confirmedSpeech = true;
        speechStarted = true;
      }
    } else if (this.state === "speech") {
      if (speechSustained) {
        this.lastVoicedMs = nowMs;
      } else if (nowMs - this.lastVoicedMs >= VAD_HANGOVER_MS) {
        if (nowMs - this.speechStartMs >= VAD_MIN_SPEECH_MS) {
          this.state = "idle";
          speechEnded = true;
        } else {
          this.state = "idle";
          this.confirmedSpeech = false;
        }
      } else {
        this.state = "hangover";
      }
    } else {
      if (speechSustained) {
        this.state = "speech";
        this.lastVoicedMs = nowMs;
      } else if (nowMs - this.lastVoicedMs >= VAD_HANGOVER_MS) {
        if (nowMs - this.speechStartMs >= VAD_MIN_SPEECH_MS) {
          this.state = "idle";
          speechEnded = true;
        } else {
          this.state = "idle";
          this.confirmedSpeech = false;
        }
      }
    }

    return {
      state: this.state,
      speechStarted,
      speechEnded,
    };
  }
}

function createEnergyVoiceActivityDetector(
  stream: MediaStream,
  callbacks: VoiceActivityCallbacks
): VoiceActivityDetector | null {
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
  let rafId: number | null = null;
  let running = false;

  const tick = () => {
    if (!running) return;
    analyser.getFloatTimeDomainData(samples);
    const transition = stateMachine.processFrame(
      extractVoiceActivityFrame(samples),
      performance.now()
    );
    if (transition.speechStarted) {
      callbacks.onSpeechStart?.();
    }
    if (transition.speechEnded) {
      callbacks.onSpeechEnd?.();
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
    isSpeechActive: () => stateMachine.isSpeechActive(),
    hasConfirmedSpeech: () => stateMachine.hasConfirmedSpeech(),
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
      stateMachine.reset();
    },
  };
}

/** Real-time VAD for mic capture — energy + ZCR with adaptive noise floor (Tauri/webview-safe). */
export async function createVoiceActivityDetector(
  stream: MediaStream,
  callbacks: VoiceActivityCallbacks = {}
): Promise<VoiceActivityDetector | null> {
  return createEnergyVoiceActivityDetector(stream, callbacks);
}
