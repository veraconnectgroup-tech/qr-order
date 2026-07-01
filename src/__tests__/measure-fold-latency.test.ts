import { describe, expect, it } from "vitest";
import {
  foldLatencySlaError,
  measureFoldLatencyMs,
} from "@/lib/denis/eval/measure-fold-latency";

describe("measureFoldLatencyMs", () => {
  it("uses median after warmup so cold-start spikes do not fail SLA", () => {
    let calls = 0;
    const ms = measureFoldLatencyMs(
      () => {
        calls += 1;
        if (calls <= 2) {
          const end = performance.now() + 50;
          while (performance.now() < end) {
            /* spin */
          }
          return;
        }
        const end = performance.now() + 1;
        while (performance.now() < end) {
          /* spin */
        }
      },
      { warmupRuns: 2, sampleRuns: 9 }
    );

    expect(ms).toBeLessThan(15);
    expect(
      foldLatencySlaError({
        ms,
        slaMs: 15,
        rows: 500,
        label: "fold SLA",
      })
    ).toBeNull();
  });
});
