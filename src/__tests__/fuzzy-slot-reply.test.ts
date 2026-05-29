import { describe, expect, it } from "vitest";
import { normalizePendingSlotReply } from "@/lib/denis/cognition/act/fuzzy-slot-reply";

const BEER_OPTIONS = ["0.3L", "0.5L"];

describe("normalizePendingSlotReply", () => {
  it("maps volume literals to menu presets when options exist", () => {
    expect(normalizePendingSlotReply("serve_size", "0.5", BEER_OPTIONS)).toBe(
      "0.5L"
    );
    expect(normalizePendingSlotReply("serve_size", "0,5", BEER_OPTIONS)).toBe(
      "0.5L"
    );
  });

  it("maps veliko povo typo to largest preset", () => {
    expect(
      normalizePendingSlotReply("serve_size", "Veliko povo", BEER_OPTIONS)
    ).toBe("0.5L");
  });

  it("maps malo to smallest preset", () => {
    expect(
      normalizePendingSlotReply("serve_size", "malo molim", BEER_OPTIONS)
    ).toBe("0.3L");
  });

  it("extracts volume from phrase", () => {
    expect(
      normalizePendingSlotReply("serve_size", "daj 0,5 molim", BEER_OPTIONS)
    ).toBe("0.5L");
  });

  it("returns original for non-serve slots", () => {
    expect(normalizePendingSlotReply("modifier", "extra cheese", [])).toBe(
      "extra cheese"
    );
  });
});
