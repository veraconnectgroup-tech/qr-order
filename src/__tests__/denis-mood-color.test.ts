import { describe, expect, it } from "vitest";
import { resolveDenisMoodColor } from "@/components/design-system/denis-mood-color";

describe("resolveDenisMoodColor", () => {
  it("is pure ember orange at intensity 0", () => {
    expect(resolveDenisMoodColor(0)).toBe("rgb(232, 93, 4)");
  });

  it("is pure alert red at intensity 1", () => {
    expect(resolveDenisMoodColor(1)).toBe("rgb(220, 38, 38)");
  });

  it("is roughly halfway between at intensity 0.5", () => {
    expect(resolveDenisMoodColor(0.5)).toBe("rgb(226, 66, 21)");
  });

  it("clamps values outside 0..1", () => {
    expect(resolveDenisMoodColor(-5)).toBe(resolveDenisMoodColor(0));
    expect(resolveDenisMoodColor(5)).toBe(resolveDenisMoodColor(1));
  });

  it("supports an alpha channel for tinted backgrounds", () => {
    expect(resolveDenisMoodColor(0, 0.12)).toBe("rgba(232, 93, 4, 0.12)");
    expect(resolveDenisMoodColor(1, 0.12)).toBe("rgba(220, 38, 38, 0.12)");
  });
});
