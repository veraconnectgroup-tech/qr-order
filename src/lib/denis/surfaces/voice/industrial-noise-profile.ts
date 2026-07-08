/**
 * Aggressive noise profile for hoods, fryers, and grill stations.
 * RNNoise-like spectral subtraction without an external WASM model.
 */

/** Tighter speech band — cuts low rumble from exhaust hoods and fryer hiss. */
export const INDUSTRIAL_VOICE_HIGHPASS_HZ = 320;
export const INDUSTRIAL_VOICE_LOWPASS_HZ = 5800;

/** Higher RMS floor than sala default — steady industrial hum sits below this. */
export const INDUSTRIAL_VOICE_NOISE_GATE_THRESHOLD = 0.035;

/** How fast the per-bin noise floor adapts to ambient drone (0–1). */
export const INDUSTRIAL_SPECTRAL_FLOOR_ALPHA = 0.08;

/** Subtracted gain below estimated noise floor (dB). */
export const INDUSTRIAL_SPECTRAL_SUPPRESSION_DB = 14;

export type IndustrialNoiseProfile = {
  highpassHz: number;
  lowpassHz: number;
  noiseGateThreshold: number;
  spectralFloorAlpha: number;
  spectralSuppressionDb: number;
};

export const INDUSTRIAL_NOISE_PROFILE: IndustrialNoiseProfile = {
  highpassHz: INDUSTRIAL_VOICE_HIGHPASS_HZ,
  lowpassHz: INDUSTRIAL_VOICE_LOWPASS_HZ,
  noiseGateThreshold: INDUSTRIAL_VOICE_NOISE_GATE_THRESHOLD,
  spectralFloorAlpha: INDUSTRIAL_SPECTRAL_FLOOR_ALPHA,
  spectralSuppressionDb: INDUSTRIAL_SPECTRAL_SUPPRESSION_DB,
};

export type IndustrialSpectralState = {
  noiseFloor: Float32Array;
};

export function createIndustrialSpectralState(binCount: number): IndustrialSpectralState {
  return { noiseFloor: new Float32Array(binCount) };
}

function byteToUnit(byte: number): number {
  return byte / 255;
}

export function updateSpectralNoiseFloor(
  floor: Float32Array,
  magnitudes: Uint8Array,
  alpha: number
): void {
  const count = Math.min(floor.length, magnitudes.length);
  for (let i = 0; i < count; i++) {
    const sample = byteToUnit(magnitudes[i]!);
    floor[i] = floor[i]! * (1 - alpha) + sample * alpha;
  }
}

function computeSpectralFlatness(magnitudes: Uint8Array): number {
  if (magnitudes.length === 0) return 0;
  let logSum = 0;
  let arithSum = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    const v = Math.max(byteToUnit(magnitudes[i]!), 0.001);
    logSum += Math.log(v);
    arithSum += v;
  }
  const geoMean = Math.exp(logSum / magnitudes.length);
  const arithMean = arithSum / magnitudes.length;
  return geoMean / arithMean;
}

export function applySpectralSubtraction(
  magnitudes: Uint8Array,
  noiseFloor: Float32Array,
  suppressionDb: number
): Float32Array {
  const suppressed = new Float32Array(magnitudes.length);
  const attenuation = Math.pow(10, -suppressionDb / 20);
  const flatness = computeSpectralFlatness(magnitudes);
  const flatnessGain = flatness > 0.9 ? 0.12 : flatness > 0.75 ? 0.45 : 1;

  for (let i = 0; i < magnitudes.length; i++) {
    const magnitude = byteToUnit(magnitudes[i]!);
    const floor = Math.max(noiseFloor[i] ?? 0, 0.001);
    const wienerGain =
      magnitude > floor
        ? Math.max(0, 1 - (floor / magnitude) ** 2)
        : 0;
    const excess = Math.max(0, magnitude - floor * attenuation);
    suppressed[i] = Math.min(excess, magnitude * wienerGain) * flatnessGain;
  }

  return suppressed;
}

export function computeTimeDomainRms(timeDomain: Uint8Array): number {
  if (timeDomain.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    const v = (timeDomain[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / timeDomain.length);
}

export function computeSuppressedSpectralEnergy(suppressed: Float32Array): number {
  if (suppressed.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < suppressed.length; i++) {
    const v = suppressed[i]!;
    sum += v * v;
  }
  return Math.sqrt(sum / suppressed.length);
}

export function computeIndustrialSignalLevel(
  frequencyData: Uint8Array,
  timeDomain: Uint8Array,
  state: IndustrialSpectralState,
  profile: IndustrialNoiseProfile = INDUSTRIAL_NOISE_PROFILE
): number {
  updateSpectralNoiseFloor(
    state.noiseFloor,
    frequencyData,
    profile.spectralFloorAlpha
  );

  const suppressed = applySpectralSubtraction(
    frequencyData,
    state.noiseFloor,
    profile.spectralSuppressionDb
  );

  const spectralEnergy = computeSuppressedSpectralEnergy(suppressed);
  const timeRms = computeTimeDomainRms(timeDomain);

  // Blend time + spectral energy — spectral path rejects steady drone.
  return spectralEnergy * 0.65 + timeRms * 0.35;
}

export function isIndustrialSignalAboveNoiseGate(
  level: number,
  profile: IndustrialNoiseProfile = INDUSTRIAL_NOISE_PROFILE
): boolean {
  return level >= profile.noiseGateThreshold;
}
