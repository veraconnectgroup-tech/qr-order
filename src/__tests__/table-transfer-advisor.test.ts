import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  areAdjacentTableNames,
  detectTransferOpportunities,
} from "@/lib/denis/intelligence/table-transfer-advisor";

describe("table transfer advisor — Prompt 88", () => {
  it("areAdjacentTableNames detects consecutive table numbers", () => {
    expect(areAdjacentTableNames("3", "4")).toBe(true);
    expect(areAdjacentTableNames("10", "11")).toBe(true);
    expect(areAdjacentTableNames("3", "5")).toBe(false);
  });

  it("does not rebalance large table when waiting party is a couple", () => {
    const suggestions = detectTransferOpportunities({
      tables: [
        {
          tableId: "t2",
          tableName: "2",
          seats: 2,
          hasActiveSession: true,
          partySize: 2,
          openOrderCount: 1,
          seatedMinutes: 20,
        },
        {
          tableId: "t6",
          tableName: "6",
          seats: 6,
          hasActiveSession: false,
          partySize: 0,
          openOrderCount: 0,
          seatedMinutes: null,
        },
      ],
      activeOrders: [{ id: "ord-2", tableId: "t2" }],
      reservations: [],
      rushMode: true,
      waitingParties: [{ tableName: "wait", partySize: 2 }],
    });

    expect(suggestions.some((row) => row.reason === "capacity_rebalance")).toBe(
      false
    );
  });

  it("suggests turnover_soon for long seated table in paying phase", () => {
    const suggestions = detectTransferOpportunities({
      tables: [
        {
          tableId: "t4",
          tableName: "4",
          seats: 4,
          hasActiveSession: true,
          partySize: 2,
          openOrderCount: 0,
          seatedMinutes: 90,
          isPayingPhase: true,
        },
      ],
      activeOrders: [{ id: "ord-4", tableId: "t4" }],
      reservations: [],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      reason: "turnover_soon",
      fromTableId: "t4",
      toTableId: "t4",
    });
    expect(suggestions[0]?.detail).toContain("Sto 4 se uskoro oslobađa");
  });

  it("suggests waitlist_table_merge for party of 6 with adjacent free tables", () => {
    const suggestions = detectTransferOpportunities({
      tables: [
        {
          tableId: "t3",
          tableName: "3",
          seats: 4,
          hasActiveSession: false,
          partySize: 0,
          openOrderCount: 0,
          seatedMinutes: null,
        },
        {
          tableId: "t4",
          tableName: "4",
          seats: 4,
          hasActiveSession: false,
          partySize: 0,
          openOrderCount: 0,
          seatedMinutes: null,
        },
      ],
      activeOrders: [],
      reservations: [],
      waitingParties: [{ tableName: "queue", partySize: 6 }],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      reason: "waitlist_table_merge",
      fromTableId: "t3",
      toTableId: "t4",
      orderIds: [],
    });
    expect(suggestions[0]?.detail).toContain("grupa od 6");
  });
});

describe("detectTransferOpportunities", () => {
  it("suggests reserved_incoming when large table has small party and upcoming reservation", () => {
    const now = Date.UTC(2026, 5, 15, 18, 0, 0);
    const suggestions = detectTransferOpportunities({
      tables: [
        {
          tableId: "t3",
          tableName: "3",
          seats: 6,
          hasActiveSession: true,
          partySize: 2,
          openOrderCount: 1,
          seatedMinutes: 40,
        },
        {
          tableId: "t8",
          tableName: "8",
          seats: 4,
          hasActiveSession: false,
          partySize: 0,
          openOrderCount: 0,
          seatedMinutes: null,
        },
      ],
      activeOrders: [{ id: "ord-1", tableId: "t3" }],
      reservations: [
        {
          tableId: "t3",
          partySize: 5,
          scheduledAt: new Date(now + 25 * 60_000).toISOString(),
        },
      ],
      partyMode: "shared_cart",
      now,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      fromTableId: "t3",
      toTableId: "t8",
      reason: "reserved_incoming",
      orderIds: ["ord-1"],
    });
  });

  it("suggests capacity_rebalance when rush and large table is underutilized", () => {
    const suggestions = detectTransferOpportunities({
      tables: [
        {
          tableId: "t3",
          tableName: "3",
          seats: 6,
          hasActiveSession: true,
          partySize: 2,
          openOrderCount: 1,
          seatedMinutes: 25,
        },
        {
          tableId: "t4",
          tableName: "4",
          seats: 4,
          hasActiveSession: false,
          partySize: 0,
          openOrderCount: 0,
          seatedMinutes: null,
        },
      ],
      activeOrders: [{ id: "ord-3", tableId: "t3" }],
      reservations: [],
      rushMode: true,
      waitingParties: [{ tableName: "7", partySize: 4 }],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      fromTableId: "t3",
      toTableId: "t4",
      reason: "capacity_rebalance",
      orderIds: ["ord-3"],
    });
  });
});
