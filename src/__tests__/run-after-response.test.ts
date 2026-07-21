import { afterEach, describe, expect, it, vi } from "vitest";

describe("runAfterResponse", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("schedules fn via next/server's after() when inside request scope", async () => {
    const afterMock = vi.fn((cb: () => Promise<void>) => {
      void cb();
    });
    vi.doMock("next/server", () => ({ after: afterMock }));
    const { runAfterResponse } = await import("@/lib/runtime/run-after-response");

    const fn = vi.fn().mockResolvedValue(undefined);
    runAfterResponse(fn);

    expect(afterMock).toHaveBeenCalledWith(fn);
    expect(fn).toHaveBeenCalled();
  });

  it("falls back to a plain fire-and-forget call when after() throws (no request scope)", async () => {
    vi.doMock("next/server", () => ({
      after: () => {
        throw new Error("after() was called outside a request scope");
      },
    }));
    const { runAfterResponse } = await import("@/lib/runtime/run-after-response");

    const fn = vi.fn().mockResolvedValue(undefined);
    runAfterResponse(fn);

    expect(fn).toHaveBeenCalled();
  });
});
