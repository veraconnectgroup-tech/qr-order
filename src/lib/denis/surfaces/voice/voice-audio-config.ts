import {
  computeIndustrialSignalLevel,
  createIndustrialSpectralState,
  INDUSTRIAL_NOISE_PROFILE,
} from "@/lib/denis/surfaces/voice/industrial-noise-profile";

/** Restaurant noise pre-processing — high-pass / low-pass band for speech. */
export const VOICE_HIGHPASS_HZ = 200;
export const VOICE_LOWPASS_HZ = 8000;

/** RMS floor below which capture is treated as mostly ambient noise. */
export const VOICE_NOISE_GATE_THRESHOLD = 0.02;

export type VoiceAudioPipeline = {
  stream: MediaStream;
  getSignalLevel: () => number;
  teardown: () => void;
};

export type VoiceAudioEnvironment = "sala" | "kitchen" | "industrial";

export const VOICE_AUDIO_ENVIRONMENTS = [
  "sala",
  "kitchen",
  "industrial",
] as const satisfies readonly VoiceAudioEnvironment[];

export type VoiceAudioProfileConfig = {
  environment: VoiceAudioEnvironment;
  inputMode: "wake-word" | "push-to-talk";
  useIndustrialNoiseProfile: boolean;
};

/** Maps ADR-051 B1 regimes: sala / kuhinja / industrijska buka. */
export function resolveVoiceAudioProfile(
  environment: VoiceAudioEnvironment
): VoiceAudioProfileConfig {
  switch (environment) {
    case "sala":
      return {
        environment,
        inputMode: "wake-word",
        useIndustrialNoiseProfile: false,
      };
    case "kitchen":
      return {
        environment,
        inputMode: "wake-word",
        useIndustrialNoiseProfile: true,
      };
    case "industrial":
      return {
        environment,
        inputMode: "push-to-talk",
        useIndustrialNoiseProfile: true,
      };
  }
}

export async function openVoiceAudioPipelineForEnvironment(
  environment: VoiceAudioEnvironment
): Promise<VoiceAudioPipeline | null> {
  const profile = resolveVoiceAudioProfile(environment);
  if (profile.useIndustrialNoiseProfile) {
    return openIndustrialVoiceAudioPipeline();
  }
  return openVoiceAudioPipeline();
}

/** Build filtered mic graph for level metering (Web Speech API uses its own capture). */
export async function openVoiceAudioPipeline(): Promise<VoiceAudioPipeline | null> {
  if (typeof window === "undefined") return null;
  if (!navigator.mediaDevices?.getUserMedia) return null;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = VOICE_HIGHPASS_HZ;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = VOICE_LOWPASS_HZ;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(analyser);

  const samples = new Uint8Array(analyser.fftSize);

  return {
    stream,
    getSignalLevel: () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        const v = (samples[i]! - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / samples.length);
    },
    teardown: () => {
      source.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      analyser.disconnect();
      void ctx.close();
      for (const track of stream.getTracks()) {
        track.stop();
      }
    },
  };
}

/**
 * Industrial variant — tighter band-pass, dynamics compression, and spectral
 * subtraction for hood/fryer/grill noise. Sala default stays on
 * `openVoiceAudioPipeline`.
 */
export async function openIndustrialVoiceAudioPipeline(): Promise<VoiceAudioPipeline | null> {
  if (typeof window === "undefined") return null;
  if (!navigator.mediaDevices?.getUserMedia) return null;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = INDUSTRIAL_NOISE_PROFILE.highpassHz;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = INDUSTRIAL_NOISE_PROFILE.lowpassHz;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 12;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(compressor);
  compressor.connect(analyser);

  const timeSamples = new Uint8Array(analyser.fftSize);
  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  const spectralState = createIndustrialSpectralState(analyser.frequencyBinCount);

  return {
    stream,
    getSignalLevel: () => {
      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(timeSamples);
      return computeIndustrialSignalLevel(
        frequencyData,
        timeSamples,
        spectralState,
        INDUSTRIAL_NOISE_PROFILE
      );
    },
    teardown: () => {
      source.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      compressor.disconnect();
      analyser.disconnect();
      void ctx.close();
      for (const track of stream.getTracks()) {
        track.stop();
      }
    },
  };
}

export function isSignalAboveNoiseGate(level: number): boolean {
  return level >= VOICE_NOISE_GATE_THRESHOLD;
}
