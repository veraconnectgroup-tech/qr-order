import { describe, expect, it, vi } from "vitest";
import {
  buildMenuItemFromProduct,
  createTranslationCache,
  formatDualLanguageDescription,
  formatDualLanguageName,
  formatHybridMenuLine,
  formatParentheticalMenuRecommendation,
  translateMenuForGuest,
  type MenuItem,
} from "@/lib/denis/intelligence/menu-translation";

const MENU: MenuItem[] = [
  {
    id: "p1",
    name: "Ćevapi sa lukom",
    description: "Domaca pljeskavica sa lukom",
    translations: {
      ar: {
        name: "تشيفابي مع البصل",
        description: "لحم مشوي مع بصل",
      },
    },
  },
  {
    id: "p2",
    name: "Burger klasik",
    description: "Juneci burger",
  },
];

const DE_MENU: MenuItem[] = [
  {
    id: "s1",
    name: "Wiener Schnitzel",
    description: "Kalbsschnitzel mit Zitrone",
  },
];

describe("menu-translation", () => {
  it("prefers static admin translations over LLM", async () => {
    const cache = createTranslationCache();
    const translated = await translateMenuForGuest({
      menu: MENU,
      targetLanguage: "ar",
      cache,
      translate: async () => ({
        name: "LLM should not win",
        description: "LLM desc",
      }),
    });

    expect(translated[0]?.translatedName).toBe("تشيفابي مع البصل");
    expect(translated[0]?.cached).toBe(false);
    expect(translated[0]?.source).toBe("static");

    const cachedRun = await translateMenuForGuest({
      menu: MENU,
      targetLanguage: "ar",
      cache,
    });
    expect(cachedRun[0]?.cached).toBe(true);
    expect(cachedRun[0]?.source).toBe("cache");
  });

  it("keeps original name in hybrid display", () => {
    const line = formatHybridMenuLine({
      id: "p1",
      originalName: "Ćevapi sa lukom",
      translatedName: "تشيفابي مع البصل",
      originalDescription: "Domaca pljeskavica",
      translatedDescription: "لحم مشوي",
      language: "ar",
      cached: true,
      source: "cache",
    });
    expect(line).toContain("Ćevapi sa lukom");
    expect(line).toContain("تشيفابي مع البصل");
  });

  it("falls back to LLM translate fn when no static row", async () => {
    const cache = createTranslationCache();
    const translated = await translateMenuForGuest({
      menu: [MENU[1]!],
      targetLanguage: "ar",
      cache,
      translate: async ({ name }) => ({
        name: `ترجمة ${name}`,
        description: "وصف",
      }),
    });
    expect(translated[0]?.translatedName).toContain("ترجمة");
    expect(translated[0]?.source).toBe("llm");
  });

  it("translates DE menu to EN for English guest", async () => {
    const cache = createTranslationCache();
    const translate = vi.fn(async () => ({
      name: "Viennese Schnitzel",
      description: "Veal cutlet with lemon",
    }));

    const translated = await translateMenuForGuest({
      menu: DE_MENU,
      targetLanguage: "en",
      sourceLanguage: "de",
      cache,
      translate,
    });

    expect(translated[0]?.originalName).toBe("Wiener Schnitzel");
    expect(translated[0]?.translatedName).toBe("Viennese Schnitzel");
    expect(translated[0]?.source).toBe("llm");
    expect(translate).toHaveBeenCalledTimes(1);

    const cachedRun = await translateMenuForGuest({
      menu: DE_MENU,
      targetLanguage: "en",
      sourceLanguage: "de",
      cache,
      translate,
    });

    expect(cachedRun[0]?.cached).toBe(true);
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it("uses admin name_en as static EN translation", async () => {
    const cache = createTranslationCache();
    const item = buildMenuItemFromProduct({
      id: "p3",
      name: "Wiener Schnitzel",
      description: "Kalbsschnitzel",
      name_en: "Viennese Schnitzel",
      description_en: "Veal cutlet",
    });

    const translated = await translateMenuForGuest({
      menu: [item],
      targetLanguage: "en",
      sourceLanguage: "de",
      cache,
      translate: async () => ({
        name: "LLM should not run",
        description: "nope",
      }),
    });

    expect(translated[0]?.translatedName).toBe("Viennese Schnitzel");
    expect(translated[0]?.source).toBe("static");
  });

  it("formats dual-language name and description for UI", () => {
    const row = {
      id: "s1",
      originalName: "Wiener Schnitzel",
      translatedName: "Viennese Schnitzel",
      originalDescription: "Kalbsschnitzel mit Zitrone",
      translatedDescription: "Veal cutlet with lemon",
      language: "en",
      cached: false,
      source: "llm" as const,
    };

    expect(formatDualLanguageName(row)).toEqual({
      primary: "Wiener Schnitzel",
      secondary: "Viennese Schnitzel",
    });
    expect(formatDualLanguageDescription(row)).toEqual({
      primary: "Kalbsschnitzel mit Zitrone",
      secondary: "Veal cutlet with lemon",
    });
  });

  it("formats parenthetical tourist recommendation", () => {
    const line = formatParentheticalMenuRecommendation({
      item: {
        id: "s1",
        originalName: "Wiener Schnitzel",
        translatedName: "Viennese Schnitzel",
        originalDescription: "Kalbsschnitzel mit Zitrone",
        translatedDescription: "Breaded veal cutlet with lemon",
        language: "en",
        cached: false,
        source: "llm",
      },
    });
    expect(line).toBe(
      "I recommend the Wiener Schnitzel (Breaded veal cutlet with lemon)."
    );
  });
});
