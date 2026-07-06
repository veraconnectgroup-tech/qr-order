import { describe, expect, it } from "vitest";
import {
  buildStaffRelationshipToneBlock,
  resolveInteractionTone,
  updateRelationshipWarmth,
} from "@/lib/denis/cognition/personality/staff-relationship-engine";

describe("resolveInteractionTone", () => {
  it("recognizes warm phrases", () => {
    expect(resolveInteractionTone("hvala ti Denise")).toBe("warm");
    expect(resolveInteractionTone("super si covece")).toBe("warm");
    expect(resolveInteractionTone("bravo")).toBe("warm");
  });

  it("recognizes curt/dismissive phrases", () => {
    expect(resolveInteractionTone("cuti vise")).toBe("curt");
    expect(resolveInteractionTone("dosta prico")).toBe("curt");
  });

  it("defaults to neutral for ordinary or empty speech", () => {
    expect(resolveInteractionTone("pet minuta")).toBe("neutral");
    expect(resolveInteractionTone("")).toBe("neutral");
  });
});

describe("updateRelationshipWarmth", () => {
  it("increases warmth on repeated warm interactions", () => {
    let state = { warmthScore: 0, interactionCount: 0 };
    for (let i = 0; i < 5; i++) {
      state = updateRelationshipWarmth(state, "warm");
    }
    expect(state.warmthScore).toBeGreaterThan(0.35);
    expect(state.interactionCount).toBe(5);
  });

  it("decreases warmth on repeated curt interactions", () => {
    let state = { warmthScore: 0, interactionCount: 0 };
    for (let i = 0; i < 5; i++) {
      state = updateRelationshipWarmth(state, "curt");
    }
    expect(state.warmthScore).toBeLessThan(-0.35);
  });

  it("clamps to [-1, 1] and never spirals past it", () => {
    let state = { warmthScore: 0, interactionCount: 0 };
    for (let i = 0; i < 50; i++) {
      state = updateRelationshipWarmth(state, "curt");
    }
    expect(state.warmthScore).toBeGreaterThanOrEqual(-1);
    expect(state.warmthScore).toBeLessThanOrEqual(1);
  });

  it("a single curt moment doesn't erase an established warm relationship", () => {
    let state = { warmthScore: 0, interactionCount: 0 };
    for (let i = 0; i < 10; i++) {
      state = updateRelationshipWarmth(state, "warm");
    }
    const beforeSingleCurt = state.warmthScore;
    state = updateRelationshipWarmth(state, "curt");
    expect(state.warmthScore).toBeGreaterThan(0);
    expect(state.warmthScore).toBeLessThan(beforeSingleCurt);
  });
});

describe("buildStaffRelationshipToneBlock", () => {
  it("uses a neutral default for a brand-new relationship", () => {
    const block = buildStaffRelationshipToneBlock({
      warmthScore: 0,
      interactionCount: 0,
    });
    expect(block).toMatch(/first interaction/i);
  });

  it("shades warmer for a consistently warm colleague", () => {
    const block = buildStaffRelationshipToneBlock({
      warmthScore: 0.6,
      interactionCount: 10,
    });
    expect(block).toMatch(/warm and appreciative/i);
  });

  it("stays professional but drier for a dismissive colleague — never rude", () => {
    const block = buildStaffRelationshipToneBlock({
      warmthScore: -0.6,
      interactionCount: 10,
    });
    expect(block).toMatch(/never rude/i);
    expect(block).toMatch(/professional/i);
  });
});
