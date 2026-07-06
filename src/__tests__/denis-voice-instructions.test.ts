import { describe, expect, it } from "vitest";
import { resolveDenisVoiceInstructions } from "@/lib/ai/denis-voice-instructions";

describe("resolveDenisVoiceInstructions", () => {
  it("stays calm at low urgency with no other signals", () => {
    const line = resolveDenisVoiceInstructions({ urgencyRatio: 0.1 });
    expect(line).toMatch(/calmly and warmly/i);
    expect(line).not.toMatch(/slammed|dismissive/i);
  });

  it("escalates tone as urgency rises", () => {
    const mid = resolveDenisVoiceInstructions({ urgencyRatio: 0.5 });
    const high = resolveDenisVoiceInstructions({ urgencyRatio: 0.9 });
    expect(mid).toMatch(/bit more urgency/i);
    expect(high).toMatch(/tension and urgency/i);
    expect(high).toMatch(/never hostile, never rude/i);
  });

  it("adds a shared-pressure clause when the venue is slammed", () => {
    const line = resolveDenisVoiceInstructions({
      urgencyRatio: 0.2,
      venueChaosRatio: 0.8,
    });
    expect(line).toMatch(/slammed/i);
  });

  it("omits the chaos clause on a calm shift", () => {
    const line = resolveDenisVoiceInstructions({
      urgencyRatio: 0.2,
      venueChaosRatio: 0.1,
    });
    expect(line).not.toMatch(/slammed/i);
  });

  it("warms up for a colleague with a consistently kind history", () => {
    const line = resolveDenisVoiceInstructions({
      urgencyRatio: 0.2,
      relationshipWarmth: 0.7,
    });
    expect(line).toMatch(/get along well/i);
  });

  it("stays professional and drier — never rude — for a dismissive colleague", () => {
    const line = resolveDenisVoiceInstructions({
      urgencyRatio: 0.2,
      relationshipWarmth: -0.7,
    });
    expect(line).toMatch(/never cold, never petty/i);
  });

  it("composes all three signals together into one instruction", () => {
    const line = resolveDenisVoiceInstructions({
      urgencyRatio: 0.9,
      venueChaosRatio: 0.8,
      relationshipWarmth: -0.5,
    });
    expect(line).toMatch(/tension and urgency/i);
    expect(line).toMatch(/slammed/i);
    expect(line).toMatch(/dismissive/i);
  });

  it("clamps out-of-range inputs instead of producing nonsense", () => {
    const line = resolveDenisVoiceInstructions({
      urgencyRatio: 5,
      venueChaosRatio: -3,
      relationshipWarmth: 10,
    });
    expect(line).toMatch(/tension and urgency/i);
    expect(line).toMatch(/get along well/i);
  });

  it("defaults venueChaosRatio and relationshipWarmth to neutral when omitted", () => {
    const line = resolveDenisVoiceInstructions({ urgencyRatio: 0.5 });
    expect(line).not.toMatch(/slammed|get along well|dismissive/i);
  });
});
