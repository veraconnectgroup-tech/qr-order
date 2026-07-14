import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

describe("loadConciergeConfigForSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("merges the running A/B experiment's variant into the base location config", async () => {
    const baseConfig = { language: { venueDefault: "sr" } } as ConciergeConfig;
    const abConfig = { language: { venueDefault: "sr" }, party: {} } as ConciergeConfig;

    vi.doMock("@/lib/denis/config/load-concierge-config", () => ({
      loadConciergeConfigForLocation: vi.fn().mockResolvedValue(baseConfig),
    }));
    const resolveLiveAbConfigForSession = vi
      .fn()
      .mockResolvedValue({ config: abConfig, variant: "B" });
    vi.doMock("@/lib/denis/experiments/live-ab-store", () => ({
      resolveLiveAbConfigForSession,
    }));

    const { loadConciergeConfigForSession } = await import(
      "@/lib/denis/runtime/load-concierge-config-for-session"
    );

    const admin = {} as SupabaseClient;
    const result = await loadConciergeConfigForSession(admin, {
      locationId: "loc-1",
      sessionToken: "session-token-abc",
    });

    expect(result).toBe(abConfig);
    expect(resolveLiveAbConfigForSession).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        locationId: "loc-1",
        sessionToken: "session-token-abc",
        baseConfig,
      })
    );
  });

  it("falls back to the plain location config when no sessionToken is given", async () => {
    const baseConfig = { language: { venueDefault: "sr" } } as ConciergeConfig;

    vi.doMock("@/lib/denis/config/load-concierge-config", () => ({
      loadConciergeConfigForLocation: vi.fn().mockResolvedValue(baseConfig),
    }));
    const resolveLiveAbConfigForSession = vi
      .fn()
      .mockResolvedValue({ config: baseConfig, variant: null });
    vi.doMock("@/lib/denis/experiments/live-ab-store", () => ({
      resolveLiveAbConfigForSession,
    }));

    const { loadConciergeConfigForSession } = await import(
      "@/lib/denis/runtime/load-concierge-config-for-session"
    );

    const admin = {} as SupabaseClient;
    const result = await loadConciergeConfigForSession(admin, {
      locationId: "loc-1",
      sessionToken: null,
    });

    expect(result).toBe(baseConfig);
  });
});
