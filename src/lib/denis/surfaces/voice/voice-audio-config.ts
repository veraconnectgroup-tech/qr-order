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

export function isSignalAboveNoiseGate(level: number): boolean {
  return level >= VOICE_NOISE_GATE_THRESHOLD;
}
