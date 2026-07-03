import { describe, expect, it } from "vitest";
import { detectGuestScript } from "@/lib/denis/cognition/conversation/script-detector";
import { detectGuestMessageLanguage } from "@/lib/ai/config";

describe("script detector cyrillic replies", () => {
  it("detects Cyrillic input and keeps Latin menu response script", () => {
    const result = detectGuestScript("Здраво, хоћу ћевапе");
    expect(result.inputScript).toBe("cyrillic");
    expect(result.responseScript).toBe("latin");
  });
});

describe("Turkish auto-detect", () => {
  it("detects Turkish from guest message", () => {
    const detection = detectGuestMessageLanguage(
      "Merhaba, menüde ne var?",
      "de"
    );
    expect(detection.detected).toBe("tr");
  });
});
