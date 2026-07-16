import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveSpokenTable,
  serbianNumberWordsToDigits,
} from "@/lib/denis/stations/resolve-spoken-table";

vi.mock("@/lib/redis/client", () => ({
  getRedisClient: () => null,
  logRedisDegradation: vi.fn(),
}));

const patchStationStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/orders/station-states", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/orders/station-states")>();
  return {
    ...actual,
    patchStationStatus: (...args: unknown[]) => patchStationStatus(...args),
  };
});

const dispatchStaffNotification = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ delivered: true })
);
vi.mock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
  dispatchStaffNotification,
}));

import { executeStationGeneralVoiceTool } from "@/lib/denis/agentic/station-general-voice-tool-catalog";

describe("serbianNumberWordsToDigits", () => {
  it("converts units, teens and compound tens", () => {
    expect(serbianNumberWordsToDigits(["dvanaest"])).toEqual(["12"]);
    expect(serbianNumberWordsToDigits(["pet"])).toEqual(["5"]);
    expect(serbianNumberWordsToDigits(["dvadeset", "pet"])).toEqual(["25"]);
    expect(serbianNumberWordsToDigits(["trideset"])).toEqual(["30"]);
  });

  it("passes non-number tokens through untouched", () => {
    expect(serbianNumberWordsToDigits(["terasa", "dva"])).toEqual([
      "terasa",
      "2",
    ]);
  });
});

describe("resolveSpokenTable", () => {
  const tables = [
    { id: "t5", name: "5" },
    { id: "t12", name: "12" },
    { id: "t25", name: "25" },
    { id: "ter2", name: "Terasa 2" },
    { id: "bas2", name: "Bašta 2" },
  ];

  it('resolves "sto dvanaest" to table 12 — "sto" is the table word, not 100', () => {
    const result = resolveSpokenTable("sto dvanaest", tables);
    expect(result.kind).toBe("match");
    if (result.kind === "match") expect(result.table.id).toBe("t12");
  });

  it('resolves "spremno za sto dvadeset pet" to table 25', () => {
    const result = resolveSpokenTable("za sto dvadeset pet", tables);
    expect(result.kind).toBe("match");
    if (result.kind === "match") expect(result.table.id).toBe("t25");
  });

  it('resolves a named zone table ("terasa dva")', () => {
    const result = resolveSpokenTable("terasa dva", tables);
    expect(result.kind).toBe("match");
    if (result.kind === "match") expect(result.table.id).toBe("ter2");
  });

  it('returns ambiguous for a bare "dva" that fits two zone tables', () => {
    const result = resolveSpokenTable("dva", tables);
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      const ids = result.candidates.map((candidate) => candidate.id);
      expect(ids).toContain("ter2");
      expect(ids).toContain("bas2");
    }
  });

  it("returns none for an unknown table", () => {
    expect(resolveSpokenTable("sto devedeset", tables).kind).toBe("none");
  });
});

describe("mark_ready_call_runner voice tool (ADR-053 M3)", () => {
  const executorInput = {
    locationId: "loc-1",
    orgId: "org-1",
    staffId: "staff-1",
    staffRole: "kitchen",
    station: "kitchen" as const,
  };

  function makeAdmin(input: {
    tables: unknown[];
    orders: unknown[];
  }): SupabaseClient {
    return {
      from: (table: string) => {
        if (table === "tables") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            is: () => chain,
            limit: async () => ({ data: input.tables }),
          };
          return chain;
        }
        if (table === "orders") {
          const chain = {
            select: () => chain,
            eq: () => chain,
            in: () => chain,
            order: () => chain,
            limit: async () => ({ data: input.orders }),
          };
          return chain;
        }
        // activity log — accept and ignore
        return { insert: async () => ({ error: null }) };
      },
    } as unknown as SupabaseClient;
  }

  beforeEach(() => {
    patchStationStatus.mockReset().mockResolvedValue({
      ok: true,
      station: "kitchen",
      stationStatus: "ready",
      globalStatus: "preparing",
      orderId: "o1",
    });
    dispatchStaffNotification.mockClear();
  });

  it("marks an in_prep order ready and calls the runner", async () => {
    const admin = makeAdmin({
      tables: [{ id: "t12", name: "12" }],
      orders: [
        {
          id: "o1",
          order_number: 41,
          order_station_states: [{ station: "kitchen", status: "in_prep" }],
        },
      ],
    });

    const result = (await executeStationGeneralVoiceTool(
      "mark_ready_call_runner",
      { ...executorInput, admin },
      { tableRef: "sto dvanaest" }
    )) as {
      ok: boolean;
      tableName?: string;
      markedOrderNumbers?: number[];
      runnerNotified?: boolean;
    };

    expect(result.ok).toBe(true);
    expect(result.tableName).toBe("12");
    expect(result.markedOrderNumbers).toEqual([41]);
    expect(result.runnerNotified).toBe(true);
    expect(patchStationStatus).toHaveBeenCalledTimes(1);
    expect(patchStationStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", status: "ready" })
    );
    expect(dispatchStaffNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "waiter_call", tableId: "t12" })
    );
  });

  it("walks a queued order through in_prep to ready (two patches)", async () => {
    const admin = makeAdmin({
      tables: [{ id: "t12", name: "12" }],
      orders: [
        {
          id: "o1",
          order_number: 41,
          order_station_states: [{ station: "kitchen", status: "queued" }],
        },
      ],
    });

    const result = (await executeStationGeneralVoiceTool(
      "mark_ready_call_runner",
      { ...executorInput, admin },
      { tableRef: "dvanaest" }
    )) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(patchStationStatus).toHaveBeenCalledTimes(2);
    expect(patchStationStatus).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ status: "in_prep" })
    );
    expect(patchStationStatus).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ status: "ready" })
    );
  });

  it("says so honestly when the table's station part is already ready — no patch, no runner call", async () => {
    const admin = makeAdmin({
      tables: [{ id: "t12", name: "12" }],
      orders: [
        {
          id: "o1",
          order_number: 41,
          order_station_states: [{ station: "kitchen", status: "ready" }],
        },
      ],
    });

    const result = (await executeStationGeneralVoiceTool(
      "mark_ready_call_runner",
      { ...executorInput, admin },
      { tableRef: "sto dvanaest" }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("already_ready");
    expect(patchStationStatus).not.toHaveBeenCalled();
    expect(dispatchStaffNotification).not.toHaveBeenCalled();
  });

  it("rejects an unknown table without touching anything", async () => {
    const admin = makeAdmin({
      tables: [{ id: "t12", name: "12" }],
      orders: [],
    });

    const result = (await executeStationGeneralVoiceTool(
      "mark_ready_call_runner",
      { ...executorInput, admin },
      { tableRef: "sto devedeset" }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_table_match");
    expect(patchStationStatus).not.toHaveBeenCalled();
  });

  it("bar staff cannot mark the kitchen station — role guard applies to voice too", async () => {
    const admin = makeAdmin({
      tables: [{ id: "t12", name: "12" }],
      orders: [
        {
          id: "o1",
          order_number: 41,
          order_station_states: [{ station: "kitchen", status: "in_prep" }],
        },
      ],
    });

    const result = (await executeStationGeneralVoiceTool(
      "mark_ready_call_runner",
      { ...executorInput, admin, staffRole: "bar" },
      { tableRef: "dvanaest" }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("patch_failed");
    expect(patchStationStatus).not.toHaveBeenCalled();
    expect(dispatchStaffNotification).not.toHaveBeenCalled();
  });
});
