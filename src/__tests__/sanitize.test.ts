import { describe, expect, it } from "vitest";
import {
  sanitizeEmail,
  sanitizeHtml,
  sanitizeOrderNotes,
  sanitizeSlug,
  sanitizeText,
  isUuid,
} from "@/lib/security/sanitize";

describe("sanitizeText", () => {
  it("removes HTML tags", () => {
    expect(sanitizeText("<b>Hello</b> <script>alert(1)</script>")).toBe(
      "Hello"
    );
  });

  it("trims whitespace and limits length", () => {
    expect(sanitizeText("   hello world   ", 5)).toBe("hello");
  });
});

describe("sanitizeHtml", () => {
  it("strips script blocks and tags", () => {
    expect(sanitizeHtml('<p>Hi</p><script>evil()</script>')).toBe("Hi");
  });
});

describe("sanitizeOrderNotes", () => {
  it("allows alphanumeric and basic punctuation", () => {
    expect(sanitizeOrderNotes("No onions, extra sauce! (table 4)")).toBe(
      "No onions, extra sauce! (table 4)"
    );
  });

  it("removes HTML and disallowed characters", () => {
    expect(sanitizeOrderNotes('<img src=x onerror=alert(1)> €€')).toBe("");
  });

  it("limits to 500 characters", () => {
    expect(sanitizeOrderNotes("a".repeat(600)).length).toBe(500);
  });
});

describe("sanitizeSlug", () => {
  it("normalizes to lowercase hyphenated slug", () => {
    expect(sanitizeSlug("Skyline Lounge & Bar!")).toBe("skyline-lounge-bar");
  });

  it("strips invalid characters", () => {
    expect(sanitizeSlug("  Hello---World  ")).toBe("hello-world");
  });
});

describe("sanitizeEmail", () => {
  it("lowercases and trims valid email", () => {
    expect(sanitizeEmail("  Guest@Example.COM  ")).toBe("guest@example.com");
  });

  it("returns empty string for invalid email", () => {
    expect(sanitizeEmail("not-an-email")).toBe("");
  });
});

describe("isUuid", () => {
  it("accepts valid UUIDs", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects injection attempts", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000,status=eq.pending")).toBe(
      false
    );
  });
});
