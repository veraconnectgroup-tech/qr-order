import { describe, expect, it } from "vitest";
import {
  detectGuestMessageLanguage,
  resolveGuestMessageLanguage,
} from "@/lib/ai/config";
import {
  advanceLanguagePersistence,
  createLanguagePersistenceState,
  parseCodeSwitchedMessage,
  resolvePersistentResponseLanguage,
} from "@/lib/denis/cognition/conversation/code-switch-parser";
import {
  detectGuestScript,
  transliterateCyrillicToLatin,
} from "@/lib/denis/cognition/conversation/script-detector";
import {
  formatParentheticalMenuRecommendation,
  formatTouristMenuLine,
} from "@/lib/denis/intelligence/menu-translation";

describe("parseCodeSwitchedMessage", () => {
  it("parses mixed SR+DE+EN and extracts menu items", () => {
    const parsed = parseCodeSwitchedMessage(
      "Daj mi ein Schnitzel und dva piva please",
      { venueLanguage: "de" }
    );

    expect(parsed.codeSwitched).toBe(true);
    expect(parsed.dominantLanguage).toBe("sr");
    expect(parsed.responseLanguage).toBe("sr");
    expect(parsed.menuItemHints).toEqual(
      expect.arrayContaining(["Schnitzel", expect.stringMatching(/dva piva/i)])
    );

    const languages = parsed.segments.map((row) => row.language);
    expect(languages).toEqual(expect.arrayContaining(["sr", "de", "en"]));
  });

  it("detects Croatian dialect from Kaj", () => {
    const parsed = parseCodeSwitchedMessage("Kaj imate na meniju?", {
      venueLanguage: "de",
    });

    expect(parsed.dialect).toBe("hr");
    expect(parsed.responseLanguage).toBe("hr");
  });

  it("activates casual mode for slang", () => {
    const parsed = parseCodeSwitchedMessage("Bre daj mi pivo ba", {
      venueLanguage: "sr",
    });
    expect(parsed.casualMode).toBe(true);
  });
});

describe("script-detector", () => {
  it("transliterates Cyrillic Serbian and responds in Latin", () => {
    const cyrillic = "дај ми бургер";
    expect(transliterateCyrillicToLatin(cyrillic)).toBe("daj mi burger");

    const script = detectGuestScript(cyrillic, { menuScript: "latin" });
    expect(script.inputScript).toBe("cyrillic");
    expect(script.responseScript).toBe("latin");
    expect(script.normalizedLatinText).toBe("daj mi burger");
  });
});

describe("detectGuestMessageLanguage upgrades", () => {
  it("detects code-switched SR dominant utterance", () => {
    const detection = detectGuestMessageLanguage(
      "Daj mi ein Schnitzel und dva piva please",
      "de"
    );

    expect(detection.detected).toBe("sr");
    expect(detection.responseLanguage).toBe("sr");
    expect(detection.codeSwitched).toBe(true);
    expect(detection.menuItemHints).toEqual(
      expect.arrayContaining(["Schnitzel"])
    );
  });

  it("understands Cyrillic input and keeps Latin response script", () => {
    const detection = detectGuestMessageLanguage("дај ми бургер", "sr");
    expect(detection.detected).toBe("sr");
    expect(detection.responseScript).toBe("latin");
  });

  it("detects Croatian from Kaj", () => {
    const detection = detectGuestMessageLanguage("Kaj imate?", "de");
    expect(detection.detected).toBe("hr");
    expect(detection.dialect).toBe("hr");
    expect(detection.responseLanguage).toBe("hr");
  });

  it("persists language after two same-language turns", () => {
    let state = createLanguagePersistenceState();

    const first = detectGuestMessageLanguage("Donesi mi jednu colu", "de", {
      languagePersistence: state,
    });
    state = advanceLanguagePersistence({
      detectedLanguage: "sr",
      prior: state,
      message: "Donesi mi jednu colu",
      script: "latin",
    });

    state = advanceLanguagePersistence({
      detectedLanguage: "sr",
      prior: state,
      message: "Još jedno pivo molim",
      script: "latin",
    });
    expect(state.confidence).toBeGreaterThanOrEqual(0.9);

    const third = detectGuestMessageLanguage("abc xyz ambiguous", "de", {
      languagePersistence: state,
    });
    expect(
      resolvePersistentResponseLanguage({
        detectedLanguage: "de",
        persistence: state,
      })
    ).toBe("sr");
    expect(third.languageConfidence).toBeGreaterThanOrEqual(0.9);
  });

  it("resolveGuestMessageLanguage prefers responseLanguage in tourist EN at DE venue", () => {
    expect(
      resolveGuestMessageLanguage("Could I get a beer please", "de")
    ).toBe("en");
  });
});

describe("menu-translation parenthetical mode", () => {
  it("formats tourist EN explanation with DE menu name", () => {
    const item = {
      id: "s1",
      originalName: "Wiener Schnitzel",
      translatedName: "Viennese Schnitzel",
      originalDescription: "Kalbsschnitzel mit Zitrone",
      translatedDescription: "Breaded veal cutlet with lemon",
      language: "en",
      cached: false,
      source: "llm" as const,
    };

    expect(formatParentheticalMenuRecommendation({ item })).toBe(
      "I recommend the Wiener Schnitzel (Breaded veal cutlet with lemon)."
    );

    const line = formatTouristMenuLine(item, { parenthetical: true });
    expect(line).toContain("Wiener Schnitzel (Viennese Schnitzel)");
    expect(line).toContain("Breaded veal cutlet with lemon");
  });
});

describe("detectGuestMessageLanguage legacy cases", () => {
  it("defaults to venue language for empty input", () => {
    expect(detectGuestMessageLanguage("", "de")).toEqual({
      detected: "de",
      confidence: "high",
      responseScript: "latin",
    });
  });

  it("marks unsupported scripts as unknown", () => {
    expect(detectGuestMessageLanguage("我要一杯可乐", "de")).toEqual({
      detected: "unknown",
      confidence: "high",
      responseScript: "latin",
    });
  });
});
