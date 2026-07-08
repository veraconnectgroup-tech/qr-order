import { describe, expect, it } from "vitest";
import {
  applySpectralSubtraction,
  computeIndustrialSignalLevel,
  computeSuppressedSpectralEnergy,
  computeTimeDomainRms,
  createIndustrialSpectralState,
  INDUSTRIAL_NOISE_PROFILE,
  INDUSTRIAL_VOICE_NOISE_GATE_THRESHOLD,
  isIndustrialSignalAboveNoiseGate,
  updateSpectralNoiseFloor,
} from "@/lib/denis/surfaces/voice/industrial-noise-profile";
import { VOICE_NOISE_GATE_THRESHOLD } from "@/lib/denis/surfaces/voice/voice-audio-config";

function fillMagnitudes(value: number, length = 16): Uint8Array {
  const data = new Uint8Array(length);
  data.fill(value);
  return data;
}

describe("industrial-noise-profile", () => {
  it("uses a tighter band and higher gate than sala defaults", () => {
    expect(INDUSTRIAL_NOISE_PROFILE.highpassHz).toBeGreaterThan(200);
    expect(INDUSTRIAL_NOISE_PROFILE.lowpassHz).toBeLessThan(8000);
    expect(INDUSTRIAL_VOICE_NOISE_GATE_THRESHOLD).toBeGreaterThan(
      VOICE_NOISE_GATE_THRESHOLD
    );
  });

  it("tracks a rising ambient noise floor over frames", () => {
    const floor = new Float32Array(4);
    updateSpectralNoiseFloor(floor, fillMagnitudes(40), 0.5);
    const afterQuiet = [...floor];

    updateSpectralNoiseFloor(floor, fillMagnitudes(200), 0.5);
    for (let i = 0; i < floor.length; i++) {
      expect(floor[i]!).toBeGreaterThan(afterQuiet[i]!);
    }
  });

  it("suppresses steady drone more than transient speech-like peaks", () => {
    const floor = new Float32Array(8);
    for (let i = 0; i < 5; i++) {
      updateSpectralNoiseFloor(floor, fillMagnitudes(180, 8), 0.2);
    }

    const drone = fillMagnitudes(185, 8);
    const speech = new Uint8Array(8);
    speech.set([60, 90, 220, 240, 210, 120, 80, 55]);

    const droneSuppressed = applySpectralSubtraction(
      drone,
      floor,
      INDUSTRIAL_NOISE_PROFILE.spectralSuppressionDb
    );
    const speechSuppressed = applySpectralSubtraction(
      speech,
      floor,
      INDUSTRIAL_NOISE_PROFILE.spectralSuppressionDb
    );

    expect(computeSuppressedSpectralEnergy(droneSuppressed)).toBeLessThan(
      computeSuppressedSpectralEnergy(speechSuppressed)
    );
  });

  it("computes blended industrial signal level from spectral + time domain", () => {
    const state = createIndustrialSpectralState(8);
    const quietTime = new Uint8Array(32).fill(128);
    const quietFreq = fillMagnitudes(30, 8);

    for (let i = 0; i < 4; i++) {
      computeIndustrialSignalLevel(quietFreq, quietTime, state);
    }

    const loudTime = new Uint8Array(32);
    for (let i = 0; i < loudTime.length; i++) {
      loudTime[i] = 128 + Math.round(40 * Math.sin(i / 2));
    }
    const loudFreq = new Uint8Array(8);
    loudFreq.set([40, 120, 230, 250, 220, 150, 70, 35]);

    const quietLevel = computeIndustrialSignalLevel(quietFreq, quietTime, state);
    const loudLevel = computeIndustrialSignalLevel(loudFreq, loudTime, state);

    expect(loudLevel).toBeGreaterThan(quietLevel);
    expect(computeTimeDomainRms(loudTime)).toBeGreaterThan(
      computeTimeDomainRms(quietTime)
    );
  });

  it("rejects levels below industrial noise gate", () => {
    expect(
      isIndustrialSignalAboveNoiseGate(INDUSTRIAL_VOICE_NOISE_GATE_THRESHOLD - 0.01)
    ).toBe(false);
    expect(
      isIndustrialSignalAboveNoiseGate(INDUSTRIAL_VOICE_NOISE_GATE_THRESHOLD + 0.02)
    ).toBe(true);
  });
});
