import { describe, expect, it } from "vitest";
import {
  buildFloorTableRows,
  deriveFloorViewStatus,
} from "@/lib/dashboard/floor-status";
import { computePeakHoursHeatmap } from "@/lib/dashboard/peak-hours";
import {
  computeOverviewDayStats,
} from "@/lib/dashboard/overview-stats";

describe("deriveFloorViewStatus", () => {
  it("marks free when no session and no orders", () => {
    expect(
      deriveFloorViewStatus({
        hasWaiterCall: false,
        session: null,
        activeOrders: [],
      })
    ).toBe("free");
  });

  it("marks ordering for pending guest orders", () => {
    expect(
      deriveFloorViewStatus({
        hasWaiterCall: false,
        session: { id: "s1" },
        activeOrders: [
          {
            status: "pending",
            payment_status: "unpaid",
          },
        ],
      })
    ).toBe("ordering");
  });

  it("marks waiting when kitchen is preparing", () => {
    expect(
      deriveFloorViewStatus({
        hasWaiterCall: false,
        session: { id: "s1" },
        activeOrders: [
          {
            status: "preparing",
            payment_status: "unpaid",
          },
        ],
      })
    ).toBe("waiting");
  });

  it("marks problem for pending waiter calls", () => {
    expect(
      deriveFloorViewStatus({
        hasWaiterCall: true,
        session: { id: "s1" },
        activeOrders: [],
      })
    ).toBe("problem");
  });
});

describe("buildFloorTableRows", () => {
  it("updates table status when a new order arrives", () => {
    const baseInput = {
      tables: [{ id: "t1", name: "5", zone_id: null, zone: null }],
      sessions: [{ id: "s1", table_id: "t1", opened_at: new Date().toISOString() }],
      waiterCallTableIds: new Set<string>(),
      aiSessionsByTable: new Map<string, string>(),
    };

    const before = buildFloorTableRows({
      ...baseInput,
      orders: [],
    });
    expect(before[0]?.status).toBe("ordering");

    const after = buildFloorTableRows({
      ...baseInput,
      orders: [
        {
          table_id: "t1",
          session_id: "s1",
          status: "pending",
          payment_status: "unpaid",
          total: 18.5,
        },
      ],
    });
    expect(after[0]?.status).toBe("ordering");
    expect(after[0]?.sessionTotal).toBe(18.5);
  });
});

describe("revenue ticker stats", () => {
  it("increments revenue and order count when a new order is added", () => {
    const before = computeOverviewDayStats([
      { total: 20, status: "delivered" },
      { total: 30, status: "delivered" },
    ]);
    const after = computeOverviewDayStats([
      { total: 20, status: "delivered" },
      { total: 30, status: "delivered" },
      { total: 15, status: "accepted" },
    ]);

    expect(after.count).toBe(before.count + 1);
    expect(after.revenue).toBeGreaterThan(before.revenue);
    expect(after.avg).toBeGreaterThan(0);
  });
});

describe("computePeakHoursHeatmap", () => {
  it("builds hourly revenue intensity buckets", () => {
    const hour = new Date().getHours();
    const createdAt = new Date();
    createdAt.setHours(hour, 15, 0, 0);

    const buckets = computePeakHoursHeatmap([
      {
        total: 40,
        status: "delivered",
        created_at: createdAt.toISOString(),
      },
      {
        total: 20,
        status: "delivered",
        created_at: createdAt.toISOString(),
      },
    ]);

    expect(buckets[hour]?.orderCount).toBe(2);
    expect(buckets[hour]?.revenue).toBe(60);
    expect(buckets[hour]?.intensity).toBe(1);
  });
});
