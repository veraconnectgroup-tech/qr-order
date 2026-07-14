import { describe, expect, it } from "vitest";
import { isPosAdapterBuilt } from "@/lib/pos/adapter-registry";

describe("isPosAdapterBuilt", () => {
  it("is true for deliverect — the only provider with a real, non-skeleton adapter", () => {
    expect(isPosAdapterBuilt("deliverect")).toBe(true);
  });

  it("is false for providers registered as skeleton-only adapters", () => {
    expect(isPosAdapterBuilt("lightspeed")).toBe(false);
    expect(isPosAdapterBuilt("orderbird")).toBe(false);
    expect(isPosAdapterBuilt("sumup")).toBe(false);
  });

  it("is false for providers with no adapter registered at all", () => {
    expect(isPosAdapterBuilt("ready2order")).toBe(false);
    expect(isPosAdapterBuilt("custom")).toBe(false);
    expect(isPosAdapterBuilt("toast")).toBe(false);
  });
});
