import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { ConciergeConfigSchema } from "@/lib/denis/config/concierge-config.schema";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { inferDenisChannelFromBody } from "@/lib/denis/surfaces/voice/infer-denis-channel";
import { normalizeVoiceTranscript } from "@/lib/denis/surfaces/voice/normalize-transcript";

describe("Denis M18 voice surface", () => {
  it("platform defaults include surfaces.voice off", () => {
    expect(() =>
      ConciergeConfigSchema.parse(CONCIERGE_PLATFORM_DEFAULTS)
    ).not.toThrow();
    expect(CONCIERGE_PLATFORM_DEFAULTS.surfaces.voiceEnabled).toBe(false);
    expect(CONCIERGE_PLATFORM_DEFAULTS.surfaces.voiceTtsEnabled).toBe(true);
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
});
