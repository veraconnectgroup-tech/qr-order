import { describe, expect, it } from "vitest";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import {
  formatSubstitutionHintBlock,
  guestSpecifiedSubstitution,
  learnSubstitutionPatterns,
  parseSubstitutionFromText,
} from "@/lib/denis/platform/substitution-intelligence";
import { learnSubstitutionPatterns as learningReexport } from "@/lib/denis/learning/substitution-patterns";
import { assessWaiterObligation } from "@/lib/denis/cognition/waiter/assess-waiter-obligation";

const SCHNITZEL = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("substitution-patterns K3", () => {
  it("parses pomfrit umesto salate from notes", () => {
    expect(parseSubstitutionFromText("pomfrit umesto salate")).toEqual({
      requested: "pomfrit",
      insteadOf: "salate",
    });
  });

  it("learns 67% pattern after 40 of 60 schnitzel orders", () => {
    const rows = Array.from({ length: 60 }, (_, index) => ({
      productId: SCHNITZEL,
      productName: "Schnitzel",
      notes:
        index < 40 ? "pomfrit umesto salate" : null,
      modifierNames: [] as string[],
    }));

    const patterns = learnSubstitutionPatterns(rows);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({
      productId: SCHNITZEL,
      original: "salate",
      replacement: "pomfrit",
      count: 40,
      percentage: 40 / 60,
    });
    expect(Math.round(patterns[0]!.percentage * 100)).toBe(67);
    expect(learningReexport(rows)).toEqual(patterns);
  });

  it("builds situation pack substitution hint", () => {
    const hint = formatSubstitutionHintBlock({
      cartLines: [
        {
          productId: SCHNITZEL,
          productName: "Schnitzel",
          notes: "",
        },
      ],
      patterns: [
        {
          productId: SCHNITZEL,
          productName: "Schnitzel",
          original: "salate",
          replacement: "pomfrit",
          count: 40,
          percentage: 0.67,
        },
      ],
      guestMessages: ["schnitzel molim"],
    });

    expect(hint).toContain("SUBSTITUTION HINT:");
    expect(hint).toContain("67%");
    expect(hint).toContain("Sa salate ili pomfrit?");
  });

  it("skips hint when guest already specified substitution", () => {
    expect(
      guestSpecifiedSubstitution({
        guestMessages: ["schnitzel sa pomfrit umesto salate"],
        cartNotes: [],
        original: "salate",
        replacement: "pomfrit",
      })
    ).toBe(true);
  });

  it("adds serve_size gap for high-confidence learned pattern", () => {
    const obligation = assessWaiterObligation({
      cartLines: [
        {
          productId: SCHNITZEL,
          productName: "Schnitzel",
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 18,
        },
      ],
      pendingSlot: null,
      language: "sr",
      guestMessage: "schnitzel",
      substitutionPatterns: [
        {
          productId: SCHNITZEL,
          productName: "Schnitzel",
          original: "salate",
          replacement: "pomfrit",
          count: 40,
          percentage: 0.67,
        },
      ],
    });

    expect(obligation.gaps.some((gap) => gap.kind === "serve_size")).toBe(true);
    expect(obligation.gaps[0]?.prompt).toContain("salate");
    expect(obligation.gaps[0]?.prompt).toContain("pomfrit");
  });

  it("asks returning guest about known modifier prefs", () => {
    const obligation = assessWaiterObligation({
      cartLines: [
        {
          productId: "burger-1",
          productName: "Burger",
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 14,
        },
      ],
      pendingSlot: null,
      language: "sr",
      guestMemory: emptyGuestMemoryProjection({
        preferredLanguage: "sr",
        visitCount: 4,
        lastVisitItemNames: ["Burger"],
        modifierPreferences: ["bez luka"],
      }),
    });

    expect(obligation.gaps.some((gap) => gap.kind === "modifier")).toBe(true);
    expect(obligation.gaps.some((gap) => gap.prompt.includes("bez luka"))).toBe(
      true
    );
  });
});
