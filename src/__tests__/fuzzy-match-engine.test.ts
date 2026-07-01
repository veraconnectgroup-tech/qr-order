import { describe, expect, it } from "vitest";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import {
  fuzzyMatchCatalog,
  normalizeNumberWords,
  normalizeVoiceArtifactToken,
} from "@/lib/ai/catalog/fuzzy-match-engine";
import {
  searchCatalogProducts,
  searchCatalogWithFuzzyOutcome,
} from "@/lib/ai/catalog/catalog-search";
import { soundex } from "@/lib/ai/catalog/phonetic-index";
import { isKeyboardProximityTypo } from "@/lib/ai/catalog/keyboard-proximity";
import {
  learnTypoCorrection,
  recordTypoCorrectionFromGuestConfirm,
} from "@/lib/denis/learning/typo-corrections";

function product(
  id: string,
  name: string,
  menuSection: AiCatalogProduct["menuSection"] = "food"
): AiCatalogProduct {
  return {
    id,
    name,
    price: 10,
    imageUrl: null,
    menuSection,
    taxRate: 19,
    allergens: [],
    modifierGroups: [],
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
  };
}

const catalog: Record<string, AiCatalogProduct> = {
  burger: product("burger", "Classic Burger"),
  schnitzel: product("schnitzel", "Wiener Schnitzel"),
  pilsner: product("pilsner", "Pilsner 0,3L", "drinks"),
  pilav: product("pilav", "Pilav sa povrćem"),
  pomfrit: product("pomfrit", "Pomfrit"),
  beer: product("beer", "Craft Lager", "drinks"),
  cola: product("cola", "Coca-Cola", "drinks"),
};

describe("fuzzy-match-engine layers", () => {
  it('matches "buregr" → Burger via fuzzy layers', () => {
    const outcome = fuzzyMatchCatalog({ catalog, query: "buregr" });
    expect(outcome.matches[0]?.productId).toBe("burger");
    expect(["levenshtein", "phonetic", "keyboard"]).toContain(
      outcome.matches[0]?.layer
    );
    expect(outcome.matches[0]?.confidence).toBeGreaterThanOrEqual(0.7);
    expect(outcome.shouldUseDirectly).toBe(true);
  });

  it('matches "sch" → Schnitzel via abbreviation layer 6', () => {
    const outcome = fuzzyMatchCatalog({ catalog, query: "sch" });
    expect(outcome.matches[0]?.productId).toBe("schnitzel");
    expect(outcome.matches[0]?.layer).toBe("abbreviation");
    expect(outcome.matches[0]?.confidence).toBe(0.85);
  });

  it("matches 🍺 emoji to beer category layer 7", () => {
    const outcome = fuzzyMatchCatalog({ catalog, query: "🍺" });
    expect(outcome.matches.map((row) => row.productId)).toEqual(
      expect.arrayContaining(["beer", "pilsner"])
    );
    expect(outcome.matches[0]?.layer).toBe("emoji");
  });

  it('asks for ambiguous "pil" → Pilsner vs Pilav', () => {
    const outcome = fuzzyMatchCatalog({ catalog, query: "pil" });
    expect(outcome.ambiguous).toBe(true);
    expect(outcome.shouldAsk).toBe(true);
    expect(outcome.clarifyPrompt).toMatch(/Pilsner.*Pilav|Pilav.*Pilsner/i);
    expect(outcome.clarifyOptions.map((row) => row.productId).sort()).toEqual([
      "pilav",
      "pilsner",
    ]);
  });

  it("uses learned correction instantly at confidence 1.0", () => {
    const learned = recordTypoCorrectionFromGuestConfirm({
      guestTypo: "bureger",
      confirmedProductId: "burger",
      confirmedProductName: "Classic Burger",
    });

    const outcome = fuzzyMatchCatalog({
      catalog,
      query: "bureger",
      learnedCorrections: learned,
    });

    expect(outcome.matches[0]?.productId).toBe("burger");
    expect(outcome.matches[0]?.layer).toBe("learned");
    expect(outcome.matches[0]?.confidence).toBe(1);
    expect(outcome.shouldUseDirectly).toBe(true);
  });

  it("normalizes voice artifact shnitzel → schnitzel", () => {
    expect(normalizeVoiceArtifactToken("shnitzel")).toBe("schnitzel");
    const outcome = fuzzyMatchCatalog({ catalog, query: "shnitzel" });
    expect(outcome.matches[0]?.productId).toBe("schnitzel");
  });

  it("normalizes number words dva → 2", () => {
    expect(normalizeNumberWords("dva piva")).toBe("2 piva");
    expect(normalizeNumberWords("drei bier")).toBe("3 bier");
  });

  it("keyboard proximity matches nurger → burger", () => {
    expect(isKeyboardProximityTypo("nurger", "burger")).toBe(true);
  });

  it("phonetic index matches borger soundex to burger", () => {
    expect(soundex("borger")).toBe(soundex("burger"));
  });
});

describe("catalog-search wired to fuzzy engine", () => {
  it('finds burger from "bruger" typo (legacy test)', () => {
    const matches = searchCatalogProducts(catalog, "bruger");
    expect(matches.map((entry) => entry.name)).toContain("Classic Burger");
  });

  it("returns fuzzy outcome with clarify prompt", () => {
    const outcome = searchCatalogWithFuzzyOutcome(catalog, "pil");
    expect(outcome.clarifyPrompt).toContain("Pilsner");
  });

  it("learned typo via searchCatalogProducts options", () => {
    const learned = learnTypoCorrection(new Map(), {
      typo: "bureger",
      productId: "burger",
      productName: "Classic Burger",
    });
    const matches = searchCatalogProducts(catalog, "bureger", 5, {
      learnedCorrections: learned,
    });
    expect(matches[0]?.id).toBe("burger");
  });
});
