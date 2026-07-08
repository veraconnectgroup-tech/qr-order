import { describe, expect, it } from "vitest";
import {
  computeRms,
  computeZeroCrossingRate,
  extractVoiceActivityFrame,
  VAD_ENERGY_START_RATIO,
  VAD_MIN_SPEECH_MS,
  VoiceActivityStateMachine,
} from "@/lib/denis/surfaces/voice/voice-activity-detector";

function sineWave(
  length: number,
  frequency: number,
  sampleRate: number,
  amplitude = 0.3
): Float32Array {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return samples;
}

function silentFrame(length: number): Float32Array {
  return new Float32Array(length);
}

describe("voice-activity-detector", () => {
  it("computes RMS and zero-crossing rate for synthetic frames", () => {
    const speech = sineWave(256, 220, 16_000, 0.25);
    const frame = extractVoiceActivityFrame(speech);

    expect(computeRms(speech)).toBeCloseTo(0.177, 2);
    expect(frame.rms).toBeCloseTo(0.177, 2);
    expect(computeZeroCrossingRate(speech)).toBeGreaterThan(0.02);
    expect(computeZeroCrossingRate(silentFrame(256))).toBe(0);
  });

  it("enters speech on voiced frames and confirms activity", () => {
    const machine = new VoiceActivityStateMachine();
    const speech = extractVoiceActivityFrame(sineWave(256, 300, 16_000, 0.35));
    let now = 0;

    for (let i = 0; i < 6; i++) {
      const transition = machine.processFrame(speech, now);
      if (i === 0) {
        expect(transition.speechStarted).toBe(true);
        expect(machine.hasConfirmedSpeech()).toBe(true);
        expect(machine.isSpeechActive()).toBe(true);
      }
      now += 30;
    }
  });

  it("ignores low-energy ambient noise", () => {
    const machine = new VoiceActivityStateMachine();
    const ambient = extractVoiceActivityFrame(silentFrame(256));
    ambient.rms = 0.004;
    ambient.zcr = 0.001;

    const transition = machine.processFrame(ambient, 0);
    expect(transition.speechStarted).toBe(false);
    expect(machine.hasConfirmedSpeech()).toBe(false);
    expect(machine.getState()).toBe("idle");
  });

  it("ends speech after hangover when voiced energy drops", () => {
    const machine = new VoiceActivityStateMachine();
    const speech = extractVoiceActivityFrame(sineWave(256, 280, 16_000, 0.4));
    const quiet = extractVoiceActivityFrame(silentFrame(256));
    quiet.rms = 0.002;
    quiet.zcr = 0.001;

    let now = 0;
    machine.processFrame(speech, now);
    now += VAD_MIN_SPEECH_MS;

    for (let i = 0; i < 20; i++) {
      now += 40;
      const transition = machine.processFrame(quiet, now);
      if (transition.speechEnded) {
        expect(machine.hasConfirmedSpeech()).toBe(true);
        expect(machine.isSpeechActive()).toBe(false);
        return;
      }
    }

    expect(machine.isSpeechActive()).toBe(false);
  });

  it("rejects steady high-energy hum via ZCR band", () => {
    const machine = new VoiceActivityStateMachine();
    const hum = extractVoiceActivityFrame(sineWave(256, 60, 16_000, 0.5));
    hum.zcr = 0.005;

    const transition = machine.processFrame(hum, 0);
    expect(transition.speechStarted).toBe(false);
    expect(hum.rms / 0.01).toBeGreaterThan(VAD_ENERGY_START_RATIO);
  });

  it("resets confirmed speech on teardown path", () => {
    const machine = new VoiceActivityStateMachine();
    const speech = extractVoiceActivityFrame(sineWave(256, 250, 16_000, 0.35));
    machine.processFrame(speech, 0);
    expect(machine.hasConfirmedSpeech()).toBe(true);

    machine.reset();
    expect(machine.hasConfirmedSpeech()).toBe(false);
    expect(machine.getState()).toBe("idle");
  });
});
