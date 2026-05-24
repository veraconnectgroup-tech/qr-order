import { describe, expect, it, beforeEach } from "vitest";
import {
  clearPinRevealMemoryCache,
  consumePinReveal,
  storePinReveal,
} from "@/lib/sessions/pin-reveal-cache";

describe("pin-reveal-cache (memory fallback)", () => {
  beforeEach(() => {
    clearPinRevealMemoryCache();
  });

  it("stores and atomically consumes PIN once", async () => {
    await storePinReveal("order-1", "1234");
    expect(await consumePinReveal("order-1")).toBe("1234");
    expect(await consumePinReveal("order-1")).toBeNull();
  });

  it("ignores empty pin on store", async () => {
    await storePinReveal("order-2", "");
    expect(await consumePinReveal("order-2")).toBeNull();
  });
});
