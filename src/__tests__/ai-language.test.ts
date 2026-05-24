import { describe, expect, it } from "vitest";
import {
  detectGuestMessageLanguage,
  resolveGuestMessageLanguage,
} from "@/lib/ai/config";

describe("detectGuestMessageLanguage", () => {
  it("defaults to venue language for empty input", () => {
    expect(detectGuestMessageLanguage("", "de")).toEqual({
      detected: "de",
      confidence: "high",
    });
  });

  it("detects Latin-script Serbian", () => {
    expect(detectGuestMessageLanguage("Donesi mi jednu colu", "de")).toEqual({
      detected: "sr",
      confidence: "high",
    });
  });

  it("detects German diacritics", () => {
    expect(
      detectGuestMessageLanguage("Ich hätte gern ein Bier bitte", "en")
    ).toEqual({
      detected: "de",
      confidence: "high",
    });
  });

  it("marks unsupported scripts as unknown", () => {
    expect(detectGuestMessageLanguage("我要一杯可乐", "de")).toEqual({
      detected: "unknown",
      confidence: "high",
    });
  });

  it("falls back to venue language with low confidence for ambiguous Latin text", () => {
    expect(detectGuestMessageLanguage("abc xyz", "de")).toEqual({
      detected: "de",
      confidence: "low",
    });
  });

  it("resolveGuestMessageLanguage maps unknown to venue language", () => {
    expect(resolveGuestMessageLanguage("我要一杯可乐", "de")).toBe("de");
  });
});
