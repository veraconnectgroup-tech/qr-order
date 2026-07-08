import { describe, expect, it } from "vitest";
import {
  resolveStationVoiceAudioEnvironment,
  resolveStationVoiceInputMode,
} from "@/lib/denis/stations/station-voice-context";
import {
  resolveVoiceAudioProfile,
  VOICE_AUDIO_ENVIRONMENTS,
} from "@/lib/denis/surfaces/voice/voice-audio-config";

describe("voice-audio-profile (ADR-051 B1)", () => {
  it("exposes three audio environments", () => {
    expect(VOICE_AUDIO_ENVIRONMENTS).toEqual(["sala", "kitchen", "industrial"]);
  });

  it("maps sala to wake-word with mild pipeline", () => {
    const profile = resolveVoiceAudioProfile("sala");
    expect(profile).toEqual({
      environment: "sala",
      inputMode: "wake-word",
      useIndustrialNoiseProfile: false,
    });
  });

  it("maps kitchen to wake-word with industrial noise profile", () => {
    const profile = resolveVoiceAudioProfile("kitchen");
    expect(profile).toEqual({
      environment: "kitchen",
      inputMode: "wake-word",
      useIndustrialNoiseProfile: true,
    });
  });

  it("maps industrial to push-to-talk with industrial noise profile", () => {
    const profile = resolveVoiceAudioProfile("industrial");
    expect(profile).toEqual({
      environment: "industrial",
      inputMode: "push-to-talk",
      useIndustrialNoiseProfile: true,
    });
  });

  it("resolves station environments for kitchen vs bar", () => {
    expect(resolveStationVoiceAudioEnvironment("kitchen")).toBe("kitchen");
    expect(resolveStationVoiceAudioEnvironment("bar")).toBe("industrial");
    expect(resolveStationVoiceInputMode("kitchen")).toBe("wake-word");
    expect(resolveStationVoiceInputMode("bar")).toBe("push-to-talk");
  });
});
