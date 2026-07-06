import { describe, expect, it } from "vitest";
import { resolveVenueChaosRatio } from "@/lib/denis/venue/floor/resolve-venue-chaos-ratio";

describe("resolveVenueChaosRatio", () => {
  it("is 0 on a calm shift (no open questions, no backlog)", () => {
    expect(
      resolveVenueChaosRatio({
        openQuestionCount: 0,
        averageBacklogMinutes: null,
      })
    ).toBe(0);
  });

  it("is 0 with a short backlog and no open questions", () => {
    const ratio = resolveVenueChaosRatio({
      openQuestionCount: 0,
      averageBacklogMinutes: 2,
    });
    expect(ratio).toBeLessThan(0.2);
  });

  it("rises toward 1 as the backlog grows", () => {
    const short = resolveVenueChaosRatio({
      openQuestionCount: 0,
      averageBacklogMinutes: 5,
    });
    const long = resolveVenueChaosRatio({
      openQuestionCount: 0,
      averageBacklogMinutes: 20,
    });
    expect(long).toBeGreaterThan(short);
    expect(long).toBe(1);
  });

  it("rises with more simultaneously open questions", () => {
    const one = resolveVenueChaosRatio({
      openQuestionCount: 1,
      averageBacklogMinutes: null,
    });
    const three = resolveVenueChaosRatio({
      openQuestionCount: 3,
      averageBacklogMinutes: null,
    });
    expect(three).toBeGreaterThan(one);
    expect(three).toBe(1);
  });

  it("takes whichever signal is worse — a long backlog alone is enough to read as slammed", () => {
    const ratio = resolveVenueChaosRatio({
      openQuestionCount: 0,
      averageBacklogMinutes: 20,
    });
    expect(ratio).toBe(1);
  });

  it("takes whichever signal is worse — many open questions alone is enough, even with a short backlog", () => {
    const ratio = resolveVenueChaosRatio({
      openQuestionCount: 3,
      averageBacklogMinutes: 1,
    });
    expect(ratio).toBe(1);
  });

  it("clamps to [0, 1] for out-of-range inputs", () => {
    const ratio = resolveVenueChaosRatio({
      openQuestionCount: 999,
      averageBacklogMinutes: 999,
    });
    expect(ratio).toBeLessThanOrEqual(1);
    expect(ratio).toBeGreaterThanOrEqual(0);
  });
});
