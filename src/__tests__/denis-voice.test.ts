import { describe, expect, it } from "vitest";
import { detectGuestMessageLanguage } from "@/lib/ai/config";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { ConciergeConfigSchema } from "@/lib/denis/config/concierge-config.schema";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";
import { normalizeDenisSignal } from "@/lib/denis/ingress/normalize-signal";
import { heuristicSlotExtract } from "@/lib/denis/runtime/perceive/heuristic-slot-extract";
import { detectVoiceLanguage } from "@/lib/denis/surfaces/voice/detect-voice-language";
import { inferDenisChannelFromBody } from "@/lib/denis/surfaces/voice/infer-denis-channel";
import { normalizeVoiceTranscript } from "@/lib/denis/surfaces/voice/normalize-transcript";
import {
  isSignalAboveNoiseGate,
  isVoiceTranscriptConfident,
  resolveVoiceTtsProfile,
  shouldRetryVoiceCapture,
  VOICE_NOISE_GATE_THRESHOLD,
  VOICE_STT_MIN_CONFIDENCE,
} from "@/lib/denis/surfaces";

describe("Denis M18 voice surface", () => {
  const tableToken = "abc123def456ghi789jkl012mno345pq";

  it("platform defaults enable guest + staff voice", () => {
    expect(() =>
      ConciergeConfigSchema.parse(CONCIERGE_PLATFORM_DEFAULTS)
    ).not.toThrow();
    expect(CONCIERGE_PLATFORM_DEFAULTS.surfaces.voiceEnabled).toBe(true);
    expect(CONCIERGE_PLATFORM_DEFAULTS.surfaces.voiceStaffEnabled).toBe(true);
    expect(CONCIERGE_PLATFORM_DEFAULTS.surfaces.voiceTtsEnabled).toBe(true);
  });

  it("Table OS pilot enables voice", () => {
    expect(TABLE_OS_PILOT_CONFIG_PATCH.surfaces!.voiceEnabled).toBe(true);
    expect(TABLE_OS_PILOT_CONFIG_PATCH.surfaces!.voiceStaffEnabled).toBe(true);
    expect(TABLE_OS_PILOT_CONFIG_PATCH.surfaces!.voiceTtsEnabled).toBe(true);
  });

  it("merges location voice override", () => {
    const merged = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, {
      surfaces: { voiceEnabled: true },
    });
    expect(merged.surfaces.voiceEnabled).toBe(true);
  });

  it("infers voice channel from inputSurface", () => {
    expect(inferDenisChannelFromBody({ inputSurface: "voice" })).toBe("voice");
    expect(inferDenisChannelFromBody({ inputSurface: "chat" })).toBe("chat");
    expect(inferDenisChannelFromBody({ message: "hello" })).toBe("chat");
  });

  it("normalizes STT transcript whitespace", () => {
    expect(normalizeVoiceTranscript("  zwei   piva  ")).toBe("zwei piva");
    expect(normalizeVoiceTranscript("   ")).toBe("");
  });

  it("voice signal surface → voice channel in ingress", () => {
    const result = normalizeDenisSignal({
      type: "message",
      text: "dva burgera",
      surface: "voice",
      tableToken,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.signal.route).toBe("turn");
    expect(result.signal.channel).toBe("voice");
  });

  it("dva burgera voice transcript → 2× burger slots", () => {
    const normalized = normalizeVoiceTranscript("dva burgera");
    const slots = heuristicSlotExtract(normalized);

    expect(slots.items).toHaveLength(1);
    expect(slots.items[0]?.quantity).toBe(2);
    expect(slots.items[0]?.productNameRaw).toMatch(/burgera/i);
  });

  it("multi-item voice order parses quantities", () => {
    const normalized = normalizeVoiceTranscript(
      "Daj mi dva burgera i jedno pivo"
    );
    const slots = heuristicSlotExtract(normalized);

    expect(slots.items.length).toBeGreaterThanOrEqual(2);
    expect(slots.items[0]?.quantity).toBe(2);
    expect(
      slots.items.some(
        (item) =>
          item.productNameRaw != null && /pivo/i.test(item.productNameRaw)
      )
    ).toBe(true);
  });

  it("low STT confidence (<70%) triggers retry", () => {
    expect(VOICE_STT_MIN_CONFIDENCE).toBe(0.7);
    expect(isVoiceTranscriptConfident(0.69)).toBe(false);
    expect(isVoiceTranscriptConfident(0.71)).toBe(true);
    expect(shouldRetryVoiceCapture(0.65)).toBe(true);
    expect(shouldRetryVoiceCapture(0.85)).toBe(false);
    expect(isVoiceTranscriptConfident(undefined)).toBe(true);
  });

  it("ambient noise below gate is rejected", () => {
    expect(isSignalAboveNoiseGate(VOICE_NOISE_GATE_THRESHOLD - 0.01)).toBe(
      false
    );
    expect(isSignalAboveNoiseGate(VOICE_NOISE_GATE_THRESHOLD + 0.05)).toBe(true);
  });

  it("German voice transcript → German reply language", () => {
    const detection = detectGuestMessageLanguage(
      "zwei Burger und ein Bier bitte",
      "sr"
    );
    expect(detection.detected).toBe("de");

    expect(detectVoiceLanguage("zwei Burger und ein Bier bitte", "sr", "en")).toBe(
      "de"
    );
  });

  it("playbook tone shapes TTS pacing", () => {
    expect(resolveVoiceTtsProfile("formal").rate).toBeLessThan(
      resolveVoiceTtsProfile("friendly").rate
    );
    expect(resolveVoiceTtsProfile("efficient").rate).toBeGreaterThan(
      resolveVoiceTtsProfile("formal").rate
    );
  });
});
