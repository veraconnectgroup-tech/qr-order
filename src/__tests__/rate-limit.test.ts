import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    const key = `unit-allow-${Date.now()}`;

    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000)).toBe(true);
    }
  });

  it("blocks requests after the limit is reached", () => {
    const key = `unit-block-${Date.now()}`;

    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }

    expect(checkRateLimit(key, 5, 60_000)).toBe(false);
  });

  it("resets after the window expires", () => {
    const key = `unit-reset-${Date.now()}`;

    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }

    expect(checkRateLimit(key, 5, 60_000)).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(checkRateLimit(key, 5, 60_000)).toBe(true);
  });
});
