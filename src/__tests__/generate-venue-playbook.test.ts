import { describe, expect, it } from "vitest";
import {
  generateVenuePlaybook,
  resolveVenuePlaybookTone,
  type PlaybookInput,
} from "@/lib/admin/generate-venue-playbook";

const baseInput: PlaybookInput = {
  venueName: "Sky Bar",
  venueType: "bar",
  menuSections: ["cocktails", "bar bites"],
  priceRange: "premium",
  topProducts: [
    { name: "Negroni Sbagliato", category: "Cocktails" },
    { name: "Old Fashioned", category: "Cocktails" },
  ],
  specialties: ["barrel-aged cocktails"],
  language: "en",
};

describe("generateVenuePlaybook (N1)", () => {
  it("bar + premium → playful_luxury tone and cocktail-first flow", () => {
    const tone = resolveVenuePlaybookTone({
      venueType: "bar",
      priceRange: "premium",
    });
    expect(tone).toBe("playful_luxury");

    const generated = generateVenuePlaybook(baseInput);
    expect(generated.tone).toBe("playful_luxury");
    expect(generated.playbook.toLowerCase()).toContain("cocktail-first");
    expect(generated.playbook).toContain("SKY BAR PLAYBOOK:");
    expect(generated.examples[0]?.assistant_message.toLowerCase()).toContain(
      "negroni"
    );
  });

  it("caps playbook at max 10 rules", () => {
    const generated = generateVenuePlaybook({
      ...baseInput,
      venueType: "restaurant",
      menuSections: ["mains", "desserts", "cocktails", "wine"],
      specialties: ["dry-aged steak", "tiramisu", "truffle pasta"],
      topProducts: [
        { name: "Ribeye", category: "Mains" },
        { name: "Tiramisu", category: "Desserts" },
        { name: "House Red", category: "Wine" },
        { name: "Negroni", category: "Cocktails" },
      ],
    });

    const ruleLines = generated.playbook
      .split("\n")
      .filter((line) => line.trim().startsWith("-"));
    expect(ruleLines.length).toBeLessThanOrEqual(10);
  });

  it("uses VKG top products in drink recommendations", () => {
    const generated = generateVenuePlaybook(baseInput);
    expect(generated.playbook).toContain("Negroni Sbagliato");
  });

  it("respects explicit tone preference over venue heuristics", () => {
    const tone = resolveVenuePlaybookTone({
      venueType: "bar",
      priceRange: "premium",
      tonePreference: "formal",
    });
    expect(tone).toBe("formal");
  });

  it("fast_food maps to efficient tone", () => {
    const generated = generateVenuePlaybook({
      ...baseInput,
      venueName: "Quick Bite",
      venueType: "fast_food",
      priceRange: "budget",
      menuSections: ["burgers", "sides"],
      topProducts: [{ name: "Classic Burger", category: "Burgers" }],
      specialties: [],
    });
    expect(generated.tone).toBe("efficient");
    expect(generated.playbook.toLowerCase()).toContain("small talk");
  });
});
