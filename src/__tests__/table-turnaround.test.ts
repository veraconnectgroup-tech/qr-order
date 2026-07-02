import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aggregateTableTurnaroundStats } from "@/lib/admin/denis-shift-report";
import { buildDailyReport, formatDailyReportDigest } from "@/lib/admin/build-daily-report";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";
import {
  BUS_TABLE_ESCALATION_PREFIX,
  BUS_TABLE_GAP_KIND,
  resolveBusTableEscalationState,
  turnaroundMinutesBetween,
} from "@/lib/denis/cognition/waiter/bus-table-obligation";
import type { WaiterGapKind } from "@/lib/denis/cognition/waiter/waiter-obligation-types";
import {
  filterBusTableEscalationNotifications,
} from "@/lib/dashboard/operations-triage";

describe("ADR-043 S13 — table turnaround (bus_table)", () => {
  it("bus_table is part of ADR-032 WaiterGapKind catalog", () => {
    const kinds: WaiterGapKind[] = [BUS_TABLE_GAP_KIND];
    expect(kinds).toContain("bus_table");
  });

  it("bus_table obligation module lives under cognition/waiter spine", () => {
    const spineRoot = join(
      process.cwd(),
      "src/lib/denis/cognition/waiter"
    );
    const types = readFileSync(
      join(spineRoot, "waiter-obligation-types.ts"),
      "utf8"
    );
    const busModule = readFileSync(
      join(spineRoot, "bus-table-obligation.ts"),
      "utf8"
    );
    expect(types).toContain('"bus_table"');
    expect(busModule).toContain("BUS_TABLE_GAP_KIND");
    expect(busModule).toContain("floor.bus_table.opened");
  });

  it("tableTurnaround flag default off, pilot enables", () => {
    expect(CONCIERGE_PLATFORM_DEFAULTS.ops.tableTurnaround.enabled).toBe(false);
    expect(TABLE_OS_PILOT_CONFIG_PATCH.ops?.tableTurnaround?.enabled).toBe(true);
  });

  it("resolveBusTableEscalationState: reminder at SLA, ops at 2× SLA", () => {
    const paidAt = "2026-07-01T20:00:00.000Z";
    const sla = 8;

    const beforeSla = resolveBusTableEscalationState({
      paidAt,
      reminderSentAt: null,
      escalatedAt: null,
      busSlaMinutes: sla,
      nowMs: Date.parse("2026-07-01T20:07:00.000Z"),
    });
    expect(beforeSla.sendReminder).toBe(false);
    expect(beforeSla.sendEscalation).toBe(false);

    const atReminder = resolveBusTableEscalationState({
      paidAt,
      reminderSentAt: null,
      escalatedAt: null,
      busSlaMinutes: sla,
      nowMs: Date.parse("2026-07-01T20:08:00.000Z"),
    });
    expect(atReminder.sendReminder).toBe(true);
    expect(atReminder.sendEscalation).toBe(false);

    const atOps = resolveBusTableEscalationState({
      paidAt,
      reminderSentAt: "2026-07-01T20:08:00.000Z",
      escalatedAt: null,
      busSlaMinutes: sla,
      nowMs: Date.parse("2026-07-01T20:16:00.000Z"),
    });
    expect(atOps.sendEscalation).toBe(true);
  });

  it("filters bus table escalation notifications for Operations Center", () => {
    const rows = filterBusTableEscalationNotifications([
      {
        id: "1",
        orgId: "o",
        locationId: "l",
        type: "denis_escalation",
        priority: "urgent",
        message: `${BUS_TABLE_ESCALATION_PREFIX} Sto 5 neraspremljen 16 min`,
        tableId: "t5",
        tableName: "Sto 5",
        actionUrl: "/waiter/tables/t5",
        readAt: null,
        createdAt: "2026-07-01T20:00:00.000Z",
      },
      {
        id: "2",
        orgId: "o",
        locationId: "l",
        type: "long_wait",
        priority: "high",
        message: "Podsetnik konobaru",
        tableId: "t2",
        tableName: "Sto 2",
        actionUrl: null,
        readAt: null,
        createdAt: "2026-07-01T20:00:00.000Z",
      },
    ]);

    expect(rows.map((row) => row.id)).toEqual(["1"]);
  });

  it("aggregates paid_at → bussed_at turnaround for daily report", () => {
    const stats = aggregateTableTurnaroundStats({
      rows: [
        {
          table_id: "t1",
          paid_at: "2026-07-01T18:00:00.000Z",
          bussed_at: "2026-07-01T18:06:00.000Z",
          status: "bussed",
        },
        {
          table_id: "t2",
          paid_at: "2026-07-01T19:00:00.000Z",
          bussed_at: "2026-07-01T19:14:00.000Z",
          status: "bussed",
        },
        {
          table_id: "t3",
          paid_at: "2026-07-01T20:00:00.000Z",
          bussed_at: null,
          status: "open",
        },
      ],
      tableNames: { t1: "Sto 1", t2: "Sto 2", t3: "Sto 3" },
    });

    expect(stats.bussedCount).toBe(2);
    expect(stats.avgTurnaroundMinutes).toBe(10);
    expect(stats.worstTableName).toBe("Sto 2");
    expect(stats.worstTurnaroundMinutes).toBe(14);
    expect(stats.openAtClose).toBe(1);
    expect(turnaroundMinutesBetween(
      "2026-07-01T18:00:00.000Z",
      "2026-07-01T18:06:00.000Z"
    )).toBe(6);

    const report = buildDailyReport({
      date: "2026-07-01",
      venueName: "Pilot",
      weekdayLabel: "Utorak",
      currencyLabel: "EUR",
      orders: [],
      sessions: [],
      feedback: [],
      denisMetrics: {
        sessionsHandled: 0,
        upsellRevenue: 0,
        upsellConversionRate: 0,
        proactiveNudgesSent: 0,
        nudgeAcceptRate: 0,
        avgResponseTime: 0,
        creditsBurned: 0,
      },
      revenueYesterday: 0,
      revenueLastWeekSameDay: 0,
      prepTimeAvgMinutes: 14,
      slowestItem: null,
      peakHour: "—",
      peakOrderCount: 0,
      returningGuestSessions: 0,
      newGuestSessions: 0,
      denisShift: {
        stationQuestions: [],
        staffNotifications: [],
        waiterCalls: [],
        stationStates: [],
        tableNames: { t1: "Sto 1", t2: "Sto 2" },
        kitchenFallbackPrepMinutes: 14,
        busObligations: [
          {
            table_id: "t2",
            paid_at: "2026-07-01T19:00:00.000Z",
            bussed_at: "2026-07-01T19:14:00.000Z",
            status: "bussed",
          },
        ],
      },
    });

    const digest = formatDailyReportDigest(report);
    expect(digest.text).toContain("Obrt stolova");
    expect(digest.html).toContain("Obrt stolova");
  });

  it("payment hook wired in runCommerceExperience", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/commerce/runtime/run-commerce-experience.ts"),
      "utf8"
    );
    expect(source).toContain("maybeCreateBusTableObligationOnPaymentSettled");
    expect(source).toContain('trigger.kind === "payment_settled"');
  });
});
