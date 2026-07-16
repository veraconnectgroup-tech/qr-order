import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/redis/client", () => ({
  getRedisClient: () => null,
  logRedisDegradation: vi.fn(),
}));

const listDueCommitments = vi.hoisted(() => vi.fn());
vi.mock("@/lib/denis/stations/denis-commitments", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/denis/stations/denis-commitments")>();
  return {
    ...actual,
    listDueCommitments: (...args: unknown[]) => listDueCommitments(...args),
  };
});

const loadTodayEightySixItems = vi.hoisted(() => vi.fn());
vi.mock("@/lib/products/eighty-six", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/products/eighty-six")>();
  return {
    ...actual,
    loadTodayEightySixItems: (...args: unknown[]) =>
      loadTodayEightySixItems(...args),
  };
});

import { executeStationGeneralVoiceTool } from "@/lib/denis/agentic/station-general-voice-tool-catalog";

function adminWithOpenMissions(rows: unknown[]): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: async () => ({ data: rows }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const executorInput = {
  locationId: "loc-1",
  orgId: "org-1",
  staffId: "staff-1",
  staffRole: "kitchen",
  station: "kitchen" as const,
};

type ReadOpenItemsResult = {
  openMissions: { title: string; forRole: string | null; urgent: boolean }[];
  myDueCommitments: { text: string; dueDate: string; overdue: boolean }[];
  currentlyEightySixed: string[];
  allClear: boolean;
};

describe("read_open_items voice tool (ADR-053 M8)", () => {
  beforeEach(() => {
    listDueCommitments.mockReset().mockResolvedValue([]);
    loadTodayEightySixItems.mockReset().mockResolvedValue([]);
  });

  it("returns the three lists grouped and readable", async () => {
    listDueCommitments.mockResolvedValue([
      {
        id: "c1",
        text: "Naruči brašno",
        due_date: "2020-01-01",
        status: "open",
      },
    ]);
    loadTodayEightySixItems.mockResolvedValue([
      {
        productId: "p1",
        productName: "Losos",
        menuSection: "food",
        eightySixedAt: "2026-07-16T10:00:00Z",
        isAvailable: false,
      },
      {
        productId: "p2",
        productName: "Bečka",
        menuSection: "food",
        eightySixedAt: "2026-07-16T09:00:00Z",
        isAvailable: true,
      },
    ]);

    const result = (await executeStationGeneralVoiceTool(
      "read_open_items",
      {
        ...executorInput,
        admin: adminWithOpenMissions([
          {
            title: "Donesi led",
            assigned_role: "waiter",
            priority: "urgent",
            created_at: "2026-07-16T11:00:00Z",
          },
        ]),
      }
    )) as ReadOpenItemsResult;

    expect(result.openMissions).toEqual([
      { title: "Donesi led", forRole: "waiter", urgent: true },
    ]);
    expect(result.myDueCommitments).toEqual([
      { text: "Naruči brašno", dueDate: "2020-01-01", overdue: true },
    ]);
    // Restored products (isAvailable: true) must not be read out as still 86'd.
    expect(result.currentlyEightySixed).toEqual(["Losos"]);
    expect(result.allClear).toBe(false);
  });

  it("reports allClear when nothing is open, due, or 86'd", async () => {
    const result = (await executeStationGeneralVoiceTool(
      "read_open_items",
      { ...executorInput, admin: adminWithOpenMissions([]) }
    )) as ReadOpenItemsResult;

    expect(result.openMissions).toEqual([]);
    expect(result.myDueCommitments).toEqual([]);
    expect(result.currentlyEightySixed).toEqual([]);
    expect(result.allClear).toBe(true);
  });

  it("scopes the 86 list to the calling station", async () => {
    await executeStationGeneralVoiceTool("read_open_items", {
      ...executorInput,
      station: "bar",
      admin: adminWithOpenMissions([]),
    });

    expect(loadTodayEightySixItems).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ station: "bar" })
    );
  });
});
