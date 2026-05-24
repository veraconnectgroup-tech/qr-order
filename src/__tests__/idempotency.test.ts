import { describe, expect, it } from "vitest";
import {
  parseIdempotencyKey,
  isIdempotencyUniqueViolation,
} from "@/lib/orders/idempotency";

describe("parseIdempotencyKey", () => {
  it("accepts valid keys", () => {
    expect(parseIdempotencyKey("abc12345")).toBe("abc12345");
    expect(parseIdempotencyKey("  uuid-like-key-001  ")).toBe("uuid-like-key-001");
  });

  it("rejects too short or empty", () => {
    expect(parseIdempotencyKey(null)).toBeNull();
    expect(parseIdempotencyKey("")).toBeNull();
    expect(parseIdempotencyKey("short")).toBeNull();
  });

  it("rejects non-printable ASCII", () => {
    expect(parseIdempotencyKey("key with spaces")).toBeNull();
  });
});

describe("isIdempotencyUniqueViolation", () => {
  it("detects postgres unique violation", () => {
    expect(isIdempotencyUniqueViolation({ code: "23505" })).toBe(true);
    expect(isIdempotencyUniqueViolation({ code: "23503" })).toBe(false);
    expect(isIdempotencyUniqueViolation(null)).toBe(false);
  });
});
