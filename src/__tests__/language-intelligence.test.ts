import { describe, expect, it } from "vitest";
import { resolveGuestQuickReplyLabels } from "@/lib/ai/guest-quick-reply-labels";
import { resolveGuestApiErrorMessage } from "@/lib/api/guest-api-errors";
import { detectGuestScript } from "@/lib/denis/cognition/conversation/script-detector";
import { detectGuestMessageLanguage } from "@/lib/ai/config";

describe("guest quick reply labels", () => {
  it("returns Turkish labels for tr", () => {
    const labels = resolveGuestQuickReplyLabels("tr");
    expect(labels.confirm).toContain("onayla");
  });

  it("returns Cyrillic chips for sr + cyrillic script", () => {
    const labels = resolveGuestQuickReplyLabels("sr", { script: "cyrillic" });
    expect(labels.yes).toBe("Да");
  });
});

describe("guest API error i18n", () => {
  it("returns Turkish invalid input message", () => {
    expect(resolveGuestApiErrorMessage("invalid_input", "tr")).toContain("Geçersiz");
  });
});

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
