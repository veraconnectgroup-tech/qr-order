import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeSpokenProductName,
  resolveSpokenProduct,
} from "@/lib/denis/stations/resolve-spoken-product";

const { redisStore, redisState } = vi.hoisted(() => ({
  redisStore: new Map<string, unknown>(),
  redisState: { available: true },
}));

vi.mock("@/lib/redis/client", () => ({
  getRedisClient: () =>
    redisState.available
      ? {
          get: async (key: string) => redisStore.get(key) ?? null,
          set: async (key: string, value: unknown) => {
            redisStore.set(key, value);
          },
          del: async (key: string) => {
            redisStore.delete(key);
          },
        }
      : null,
  logRedisDegradation: vi.fn(),
}));

const setProductAvailabilityTx = vi.hoisted(() => vi.fn());
vi.mock("@/lib/products/eighty-six", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/products/eighty-six")>();
  return {
    ...actual,
    setProductAvailabilityTx: (...args: unknown[]) =>
      setProductAvailabilityTx(...args),
  };
});

import { executeStationGeneralVoiceTool } from "@/lib/denis/agentic/station-general-voice-tool-catalog";

describe("resolveSpokenProduct", () => {
  const catalog = [
    { id: "p1", name: "Losos sa gril povrćem" },
    { id: "p2", name: "Ćevapi u lepinji" },
    { id: "p3", name: "Karađorđeva šnicla" },
    { id: "p4", name: "Bečka šnicla" },
  ];

  it("matches an inflected spoken form (\"lososa\" -> Losos ...)", () => {
    const result = resolveSpokenProduct("lososa", catalog);
    expect(result.kind).toBe("match");
    if (result.kind === "match") {
      expect(result.product.id).toBe("p1");
    }
  });

  it("matches diacritic-free speech (\"cevapi\" -> Ćevapi)", () => {
    const result = resolveSpokenProduct("cevapi", catalog);
    expect(result.kind).toBe("match");
    if (result.kind === "match") {
      expect(result.product.id).toBe("p2");
    }
  });

  it("returns ambiguous when two products are equally plausible (\"šnicla\")", () => {
    const result = resolveSpokenProduct("šnicla", catalog);
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      const ids = result.candidates.map((candidate) => candidate.id);
      expect(ids).toContain("p3");
      expect(ids).toContain("p4");
    }
  });

  it("returns none for something not on the menu", () => {
    expect(resolveSpokenProduct("pica margarita", catalog).kind).toBe("none");
  });

  it("normalizes diacritics and punctuation", () => {
    expect(normalizeSpokenProductName("  Ćevapi, u lepinji!  ")).toBe(
      "cevapi u lepinji"
    );
  });
});

describe("voice 86 propose/confirm gate", () => {
  const executorInput = {
    admin: null as unknown as SupabaseClient,
    locationId: "loc-1",
    orgId: "org-1",
    staffId: "staff-1",
    staffRole: "kitchen",
    station: "kitchen" as const,
  };

  function adminWithProducts(rows: unknown[]) {
    return {
      from: (table: string) => {
        if (table !== "products") {
          // fire-and-forget activity log writes — accept and ignore
          return { insert: async () => ({ error: null }) };
        }
        return {
          select: (columns: string) => {
            if (!columns.includes("categories")) {
              // propose step: list query ends in .limit()
              const chain = {
                eq: () => chain,
                is: () => chain,
                limit: async () => ({ data: rows }),
              };
              return chain;
            }
            // loadProductForAvailability: single row lookup
            const chain = {
              eq: () => chain,
              is: () => chain,
              maybeSingle: async () => ({
                data: {
                  id: "p1",
                  name: "Losos sa gril povrćem",
                  is_available: true,
                  location_id: "loc-1",
                  categories: { menu_section: "food" },
                },
              }),
            };
            return chain;
          },
        };
      },
    } as unknown as SupabaseClient;
  }

  beforeEach(() => {
    redisStore.clear();
    redisState.available = true;
    setProductAvailabilityTx.mockReset();
    setProductAvailabilityTx.mockResolvedValue({ ok: true, changed: true });
  });

  it("confirm WITHOUT a prior propose is rejected — the gate is deterministic", async () => {
    const result = (await executeStationGeneralVoiceTool(
      "confirm_eighty_six",
      { ...executorInput, admin: adminWithProducts([]) },
      { productId: "p1" }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_pending_proposal");
    expect(setProductAvailabilityTx).not.toHaveBeenCalled();
  });

  it("propose then confirm executes the change exactly once and clears the proposal", async () => {
    const admin = adminWithProducts([
      { id: "p1", name: "Losos sa gril povrćem", is_available: true },
    ]);

    const proposed = (await executeStationGeneralVoiceTool(
      "propose_eighty_six",
      { ...executorInput, admin },
      { productName: "lososa", action: "remove" }
    )) as { ok: boolean; productId?: string; resolvedName?: string };

    expect(proposed.ok).toBe(true);
    expect(proposed.productId).toBe("p1");
    expect(setProductAvailabilityTx).not.toHaveBeenCalled();

    const confirmed = (await executeStationGeneralVoiceTool(
      "confirm_eighty_six",
      { ...executorInput, admin },
      { productId: "p1" }
    )) as { ok: boolean };

    expect(confirmed.ok).toBe(true);
    expect(setProductAvailabilityTx).toHaveBeenCalledTimes(1);

    // The proposal is single-shot — a second confirm must be rejected.
    const replay = (await executeStationGeneralVoiceTool(
      "confirm_eighty_six",
      { ...executorInput, admin },
      { productId: "p1" }
    )) as { ok: boolean; error?: string };
    expect(replay.ok).toBe(false);
    expect(replay.error).toBe("no_pending_proposal");
  });

  it("confirm with a DIFFERENT productId than proposed is rejected", async () => {
    const admin = adminWithProducts([
      { id: "p1", name: "Losos sa gril povrćem", is_available: true },
    ]);

    await executeStationGeneralVoiceTool(
      "propose_eighty_six",
      { ...executorInput, admin },
      { productName: "lososa", action: "remove" }
    );

    const result = (await executeStationGeneralVoiceTool(
      "confirm_eighty_six",
      { ...executorInput, admin },
      { productId: "p2" }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_pending_proposal");
    expect(setProductAvailabilityTx).not.toHaveBeenCalled();
  });

  it("fails closed when Redis is unavailable — no unconfirmed destructive write path", async () => {
    redisState.available = false;
    const admin = adminWithProducts([
      { id: "p1", name: "Losos sa gril povrćem", is_available: true },
    ]);

    const proposed = (await executeStationGeneralVoiceTool(
      "propose_eighty_six",
      { ...executorInput, admin },
      { productName: "lososa", action: "remove" }
    )) as { ok: boolean; error?: string };
    expect(proposed.ok).toBe(false);
    expect(proposed.error).toBe("confirmation_unavailable");

    const confirmed = (await executeStationGeneralVoiceTool(
      "confirm_eighty_six",
      { ...executorInput, admin },
      { productId: "p1" }
    )) as { ok: boolean; error?: string };
    expect(confirmed.ok).toBe(false);
    expect(confirmed.error).toBe("confirmation_unavailable");
    expect(setProductAvailabilityTx).not.toHaveBeenCalled();
  });

  it("bar staff cannot 86 a kitchen item — role gate from the existing panel applies to voice too", async () => {
    const admin = adminWithProducts([
      { id: "p1", name: "Losos sa gril povrćem", is_available: true },
    ]);

    const result = (await executeStationGeneralVoiceTool(
      "propose_eighty_six",
      { ...executorInput, admin, staffRole: "bar", station: "bar" },
      { productName: "lososa", action: "remove" }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("role_not_allowed");
  });
});
