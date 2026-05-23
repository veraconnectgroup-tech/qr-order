import { describe, expect, it } from "vitest";
import { sanitizeText } from "@/lib/security/sanitize";

describe("sanitizeText", () => {
  it("removes HTML tags", () => {
    expect(sanitizeText("<b>Hello</b> <script>alert(1)</script>")).toBe(
      "Hello alert(1)"
    );
  });

  it("trims whitespace and limits length", () => {
    expect(sanitizeText("   hello world   ", 5)).toBe("hello");
  });
});
