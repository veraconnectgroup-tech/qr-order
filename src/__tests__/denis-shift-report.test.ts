import { describe, expect, it } from "vitest";
import {
  aggregateEscalationCounts,
  aggregateStationDelays,
  aggregateStationQuestionStats,
  buildDenisShiftRecap,
  countPreventedProblems,
  emptyDenisShiftRecap,
  findRiskiestTable,
} from "@/lib/admin/denis-shift-report";

describe("denis shift recap (ADR-043 S6)", () => {
  it("aggregates station questions per station with avg answer time", () => {
    const stats = aggregateStationQuestionStats([
      {
        station: "kitchen",
        status: "answered",
        asked_at: "2026-06-27T18:00:00.000Z",
        answered_at: "2026-06-27T18:05:00.000Z",
        expires_at: "2026-06-27T18:12:00.000Z",
        table_id: "t1",
        order_id: "o1",
      },
      {
        station: "kitchen",
        status: "expired",
        asked_at: "2026-06-27T19:00:00.000Z",
        answered_at: null,
        expires_at: "2026-06-27T19:12:00.000Z",
        table_id: "t2",
        order_id: "o2",
      },
      {
        station: "bar",
        status: "answered",
        asked_at: "2026-06-27T20:00:00.000Z",
        answered_at: "2026-06-27T20:03:00.000Z",
        expires_at: "2026-06-27T20:12:00.000Z",
        table_id: "t1",
        order_id: "o3",
      },
    ]);

    expect(stats).toEqual([
      {
        station: "kitchen",
        asked: 2,
        answered: 1,
        expired: 1,
        avgAnswerMinutes: 5,
      },
      {
        station: "bar",
        asked: 1,
        answered: 1,
        expired: 0,
        avgAnswerMinutes: 3,
      },
    ]);
  });

  it("counts escalations by type and priority", () => {
    const counts = aggregateEscalationCounts([
      {
        type: "denis_escalation",
        priority: "urgent",
        table_id: "t1",
        created_at: "2026-06-27T18:00:00.000Z",
      },
      {
        type: "long_wait",
        priority: "high",
        table_id: "t2",
        created_at: "2026-06-27T18:05:00.000Z",
      },
      {
        type: "denis_escalation",
        priority: "medium",
        table_id: null,
        created_at: "2026-06-27T18:10:00.000Z",
      },
    ]);

    expect(counts.total).toBe(3);
    expect(counts.byType).toEqual({
      denis_escalation: 2,
      long_wait: 1,
    });
    expect(counts.byPriority).toEqual({
      urgent: 1,
      high: 1,
      medium: 1,
    });
  });

  it("finds riskiest table from questions, staff notifications, and waiter calls", () => {
    const riskiest = findRiskiestTable({
      stationQuestions: [
        {
          station: "kitchen",
          status: "open",
          asked_at: "2026-06-27T18:00:00.000Z",
          answered_at: null,
          expires_at: "2026-06-27T18:12:00.000Z",
          table_id: "t1",
          order_id: "o1",
        },
        {
          station: "bar",
          status: "open",
          asked_at: "2026-06-27T18:01:00.000Z",
          answered_at: null,
          expires_at: "2026-06-27T18:13:00.000Z",
          table_id: "t1",
          order_id: "o1",
        },
      ],
      staffNotifications: [
        {
          type: "denis_escalation",
          priority: "urgent",
          table_id: "t2",
          created_at: "2026-06-27T18:02:00.000Z",
        },
      ],
      waiterCalls: [{ table_id: "t1", created_at: "2026-06-27T18:03:00.000Z" }],
      tableNames: { t1: "Sto 7", t2: "Sto 3" },
    });

    expect(riskiest).toEqual({
      tableId: "t1",
      tableName: "Sto 7",
      questionCount: 2,
      escalationCount: 0,
      waiterCallCount: 1,
      riskScore: 5,
    });
  });

  it("computes per-station prep delay with kitchen prior fallback", () => {
    const delays = aggregateStationDelays({
      stationStates: [
        {
          station: "kitchen",
          in_prep_at: "2026-06-27T18:00:00.000Z",
          ready_at: "2026-06-27T18:20:00.000Z",
        },
        {
          station: "bar",
          in_prep_at: "2026-06-27T18:00:00.000Z",
          ready_at: "2026-06-27T18:06:00.000Z",
        },
      ],
      kitchenFallbackPrepMinutes: 14,
    });

    expect(delays).toEqual([
      { station: "kitchen", avgPrepMinutes: 20, sampleCount: 1 },
      { station: "bar", avgPrepMinutes: 6, sampleCount: 1 },
    ]);
  });

  it("uses kitchen prior when no station state samples exist", () => {
    const delays = aggregateStationDelays({
      stationStates: [],
      kitchenFallbackPrepMinutes: 14,
    });

    expect(delays).toEqual([
      { station: "kitchen", avgPrepMinutes: 14, sampleCount: 0 },
      { station: "bar", avgPrepMinutes: null, sampleCount: 0 },
    ]);
  });

  it("counts prevented problems when answered before expiry", () => {
    const prevented = countPreventedProblems([
      {
        station: "kitchen",
        status: "answered",
        asked_at: "2026-06-27T18:00:00.000Z",
        answered_at: "2026-06-27T18:05:00.000Z",
        expires_at: "2026-06-27T18:12:00.000Z",
        table_id: "t1",
        order_id: "o1",
      },
      {
        station: "kitchen",
        status: "answered",
        asked_at: "2026-06-27T19:00:00.000Z",
        answered_at: "2026-06-27T19:15:00.000Z",
        expires_at: "2026-06-27T19:12:00.000Z",
        table_id: "t2",
        order_id: "o2",
      },
      {
        station: "bar",
        status: "expired",
        asked_at: "2026-06-27T20:00:00.000Z",
        answered_at: null,
        expires_at: "2026-06-27T20:12:00.000Z",
        table_id: "t3",
        order_id: "o3",
      },
    ]);

    expect(prevented).toBe(1);
  });

  it("returns empty recap for a day without questions", () => {
    const recap = emptyDenisShiftRecap(12);

    expect(recap.stationQuestions).toEqual([
      {
        station: "kitchen",
        asked: 0,
        answered: 0,
        expired: 0,
        avgAnswerMinutes: null,
      },
      {
        station: "bar",
        asked: 0,
        answered: 0,
        expired: 0,
        avgAnswerMinutes: null,
      },
    ]);
    expect(recap.escalations.total).toBe(0);
    expect(recap.riskiestTable).toBeNull();
    expect(recap.preventedProblems).toBe(0);
    expect(recap.stationDelays[0]?.avgPrepMinutes).toBe(12);
  });

  it("buildDenisShiftRecap composes full shift snapshot", () => {
    const recap = buildDenisShiftRecap({
      stationQuestions: [
        {
          station: "kitchen",
          status: "answered",
          asked_at: "2026-06-27T18:00:00.000Z",
          answered_at: "2026-06-27T18:04:00.000Z",
          expires_at: "2026-06-27T18:12:00.000Z",
          table_id: "t1",
          order_id: "o1",
        },
      ],
      staffNotifications: [],
      waiterCalls: [],
      stationStates: [],
      tableNames: { t1: "Sto 7" },
      kitchenFallbackPrepMinutes: 15,
    });

    expect(recap.preventedProblems).toBe(1);
    expect(recap.stationQuestions[0]?.answered).toBe(1);
    expect(recap.riskiestTable?.tableName).toBe("Sto 7");
  });
});
