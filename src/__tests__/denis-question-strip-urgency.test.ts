import { describe, expect, it } from "vitest";
import {
  extractWaitMinutes,
  resolveUrgency,
} from "@/components/stations/denis-question-strip";

describe("resolveUrgency", () => {
  const askedAt = "2026-01-01T12:00:00.000Z";
  const expiresAt = "2026-01-01T12:02:00.000Z"; // 120s window

  it("is normal right after asking", () => {
    const now = Date.parse(askedAt) + 10_000; // 10s in, 8%
    expect(resolveUrgency(askedAt, expiresAt, now)).toBe("normal");
  });

  it("becomes urgent past 40% elapsed", () => {
    const now = Date.parse(askedAt) + 50_000; // 50s in, ~42%
    expect(resolveUrgency(askedAt, expiresAt, now)).toBe("urgent");
  });

  it("becomes critical past 75% elapsed", () => {
    const now = Date.parse(askedAt) + 100_000; // 100s in, ~83%
    expect(resolveUrgency(askedAt, expiresAt, now)).toBe("critical");
  });

  it("falls back to normal for a malformed/zero window", () => {
    expect(resolveUrgency(askedAt, askedAt, Date.parse(askedAt))).toBe("normal");
  });

  it("stays critical for a badly overdue order even moments after a fresh re-ask", () => {
    const now = Date.parse(askedAt) + 1_000; // 1s in, ~1% of the short timer
    expect(resolveUrgency(askedAt, expiresAt, now, 154)).toBe("critical");
  });

  it("is not inflated by a short wait", () => {
    const now = Date.parse(askedAt) + 10_000;
    expect(resolveUrgency(askedAt, expiresAt, now, 3)).toBe("normal");
  });
});

describe("extractWaitMinutes", () => {
  it("reads the minute count out of the staff-facing message", () => {
    expect(
      extractWaitMinutes("Sto Table 2 · Bon #3 čeka 154 min bez prihvatanja. Kreće li priprema?")
    ).toBe(154);
  });

  it("returns null when the message has no minute count", () => {
    expect(extractWaitMinutes("Sto Table 2 — nema informacija.")).toBeNull();
  });
});
