import { describe, expect, it } from "vitest";
import {
  DEFAULT_READY_STUCK_MINUTES,
  filterBurningNotifications,
  filterOpenServiceRecoveryNotifications,
  filterReadyStuckRows,
  filterRiskPriorityTables,
  formatExpiryCountdown,
  secondsUntilExpiry,
} from "@/lib/dashboard/operations-triage";

describe("operations-triage", () => {
  const NOW = Date.parse("2026-07-01T20:00:00Z");

  it("filters unread urgent/high Denis notifications", () => {
    const rows = filterBurningNotifications([
      {
        id: "1",
        orgId: "o",
        locationId: "l",
        type: "long_wait",
        priority: "urgent",
        message: "Hitno",
        tableId: null,
        tableName: null,
        actionUrl: null,
        readAt: null,
        createdAt: "2026-07-01T19:00:00.000Z",
      },
      {
        id: "2",
        orgId: "o",
        locationId: "l",
        type: "long_wait",
        priority: "normal",
        message: "FYI",
        tableId: null,
        tableName: null,
        actionUrl: null,
        readAt: null,
        createdAt: "2026-07-01T19:00:00.000Z",
      },
      {
        id: "3",
        orgId: "o",
        locationId: "l",
        type: "long_wait",
        priority: "high",
        message: "Pročitano",
        tableId: null,
        tableName: null,
        actionUrl: null,
        readAt: "2026-07-01T19:30:00.000Z",
        createdAt: "2026-07-01T19:00:00.000Z",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("1");
  });

  it("filters unread Recovery — notifications for ops center", () => {
    const rows = filterOpenServiceRecoveryNotifications([
      {
        id: "r1",
        orgId: "o",
        locationId: "l",
        type: "denis_escalation",
        priority: "urgent",
        message: "Recovery — Sto 2 · guest_complaint",
        tableId: "t2",
        tableName: "Sto 2",
        actionUrl: null,
        readAt: null,
        createdAt: "2026-07-01T19:00:00.000Z",
      },
      {
        id: "r2",
        orgId: "o",
        locationId: "l",
        type: "denis_escalation",
        priority: "urgent",
        message: "Recovery — Sto 1",
        tableId: "t1",
        tableName: "Sto 1",
        actionUrl: null,
        readAt: "2026-07-01T19:30:00.000Z",
        createdAt: "2026-07-01T19:00:00.000Z",
      },
    ]);

    expect(rows.map((row) => row.id)).toEqual(["r1"]);
  });

  it("keeps only urgent/high copilot priority tables", () => {
    const rows = filterRiskPriorityTables([
      { tableId: "a", priority: "urgent" },
      { tableId: "b", priority: "normal" },
      { tableId: "c", priority: "high" },
    ]);

    expect(rows.map((row) => row.tableId)).toEqual(["a", "c"]);
  });

  it("filters ready rows older than threshold", () => {
    const rows = filterReadyStuckRows(
      [
        {
          orderId: "o1",
          orderNumber: 1,
          station: "bar",
          readyAt: "2026-07-01T19:56:00.000Z",
          waitMinutes: 4,
          tableId: null,
          tableName: "12",
        },
        {
          orderId: "o2",
          orderNumber: 2,
          station: "kitchen",
          readyAt: "2026-07-01T19:59:30.000Z",
          waitMinutes: 0,
          tableId: null,
          tableName: "3",
        },
      ],
      DEFAULT_READY_STUCK_MINUTES,
      NOW
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.orderId).toBe("o1");
  });

  it("formats expiry countdown for station questions", () => {
    expect(
      secondsUntilExpiry("2026-07-01T20:01:30.000Z", NOW)
    ).toBe(90);
    expect(formatExpiryCountdown(90)).toBe("1m 30s");
    expect(formatExpiryCountdown(45)).toBe("45s");
  });
});
