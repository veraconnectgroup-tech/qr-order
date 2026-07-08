import { describe, expect, it } from "vitest";
import {
  computeEnergyEnvelope,
  DENIS_WAKE_PHRASE,
  isWakePhraseMatch,
  isWakeWordAcousticMatch,
  normalizeWakeTranscript,
  scoreWakeWordEnergyMatch,
  stripWakePhrasePrefix,
  WAKE_WORD_ENERGY_TEMPLATE,
} from "@/lib/denis/surfaces/voice/wake-word-detector";

describe("wake-word-detector", () => {
  it("normalizes wake phrase variants", () => {
    expect(normalizeWakeTranscript("  Hej, Denise! ")).toBe("hej denise");
    expect(normalizeWakeTranscript("HEY DENISE")).toBe("hey denise");
  });

  it("matches supported wake phrase aliases", () => {
    expect(isWakePhraseMatch("hej denise")).toBe(true);
    expect(isWakePhraseMatch("hey denise")).toBe(true);
    expect(isWakePhraseMatch("Ej Denise, dva piva")).toBe(true);
    expect(isWakePhraseMatch("dva piva molim")).toBe(false);
  });

  it("strips wake phrase prefix from command transcript", () => {
    expect(stripWakePhrasePrefix("Hej Denise dva piva")).toBe("dva piva");
    expect(stripWakePhrasePrefix("hey denise")).toBe("");
    expect(stripWakePhrasePrefix("dva piva")).toBe("dva piva");
  });

  it("scores synthetic wake envelope above threshold", () => {
    const envelope = WAKE_WORD_ENERGY_TEMPLATE.map(
      (value, index) => value * (0.9 + (index % 3) * 0.03)
    );
    const score = scoreWakeWordEnergyMatch(envelope);
    expect(score).toBeGreaterThan(0.8);
    expect(isWakeWordAcousticMatch(envelope)).toBe(true);
  });

  it("rejects flat non-speech envelope", () => {
    const drone = Array.from({ length: 10 }, () => 0.42);
    const score = scoreWakeWordEnergyMatch(drone);
    expect(score).toBeLessThan(0.5);
    expect(isWakeWordAcousticMatch(drone)).toBe(false);
  });

  it("normalizes energy envelope peaks to unity", () => {
    const envelope = computeEnergyEnvelope([0.1, 0.5, 0.25]);
    expect(envelope[1]).toBe(1);
    expect(envelope[0]).toBeCloseTo(0.2, 5);
  });

  it("uses canonical wake phrase constant", () => {
    expect(DENIS_WAKE_PHRASE).toBe("hej denise");
    expect(isWakePhraseMatch(DENIS_WAKE_PHRASE)).toBe(true);
  });
});
