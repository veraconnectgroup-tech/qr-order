import { describe, expect, it } from "vitest";
import { sanitizeText } from "@/lib/security/sanitize";

describe("sanitizeText", () => {
  it("removes script tags but keeps inner text", () => {
    expect(sanitizeText("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("trims whitespace", () => {
    expect(sanitizeText("   hello   ")).toBe("hello");
  });

  it("respects maxLength", () => {
    expect(sanitizeText("hello world", 5)).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeText("")).toBe("");
  });
});
