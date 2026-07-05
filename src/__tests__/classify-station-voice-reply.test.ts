import { describe, expect, it } from "vitest";
import { classifyStationVoiceReply } from "@/lib/denis/stations/classify-station-voice-reply";

describe("classifyStationVoiceReply", () => {
  it("reads spoken minutes for an eta question", () => {
    expect(classifyStationVoiceReply("5 minuta", "eta")).toEqual({
      answer: "eta",
      etaMinutes: 5,
    });
    expect(classifyStationVoiceReply("pet minuta", "eta")).toEqual({
      answer: "eta",
      etaMinutes: 5,
    });
    expect(classifyStationVoiceReply("za deset minuta", "eta")).toEqual({
      answer: "eta",
      etaMinutes: 10,
    });
  });

  it("recognizes 'ready' for an eta question", () => {
    expect(classifyStationVoiceReply("gotovo je", "eta")).toEqual({
      answer: "ready",
    });
    expect(classifyStationVoiceReply("spremno", "mixed_conflict")).toEqual({
      answer: "ready",
    });
  });

  it("recognizes 'problem' regardless of question type", () => {
    expect(classifyStationVoiceReply("imamo problem", "eta")).toEqual({
      answer: "problem",
    });
    expect(
      classifyStationVoiceReply("kasnice malo", "pending_accept")
    ).toEqual({ answer: "problem" });
  });

  it("recognizes 'accepted' for a pending_accept question", () => {
    expect(
      classifyStationVoiceReply("krece odmah", "pending_accept")
    ).toEqual({ answer: "accepted" });
    expect(
      classifyStationVoiceReply("pocinjem sad", "pending_accept")
    ).toEqual({ answer: "accepted" });
  });

  it("recognizes picked_up / still_waiting for a ready_pickup question", () => {
    expect(
      classifyStationVoiceReply("preuzeto je", "ready_pickup")
    ).toEqual({ answer: "picked_up" });
    expect(
      classifyStationVoiceReply("jos ceka", "ready_pickup")
    ).toEqual({ answer: "still_waiting" });
  });

  it("returns null for unrecognized or empty speech", () => {
    expect(classifyStationVoiceReply("", "eta")).toBeNull();
    expect(classifyStationVoiceReply("blah blah nesto random", "eta")).toBeNull();
  });
});
