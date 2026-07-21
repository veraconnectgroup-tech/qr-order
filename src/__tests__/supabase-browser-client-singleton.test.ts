import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
  },
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ id: Math.random() })),
}));

describe("createClient (browser Supabase client)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns the same client instance across calls — one Realtime socket per tab", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const { createClient } = await import("@/lib/supabase/client");

    const first = createClient();
    const second = createClient();
    const third = createClient();

    expect(second).toBe(first);
    expect(third).toBe(first);
    // Regression guard for the Realtime connection-quota incident: dozens of
    // usePostgresRealtime() call sites each called createClient() — if this
    // ever creates a new client per call again, each gets its own physical
    // Realtime WebSocket instead of multiplexing over one.
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
  });
});
