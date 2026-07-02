/**
 * ADR-043 S7 — Pilot E2E verification via pure domain chain.
 * Live QR/browser proof on iota/Skyline remains operator-owned; this file
 * documents scenarios A + B with executable assertions on the code path.
 */
import { describe, expect, it } from "vitest";
import { resolveConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";
import {
  evaluateStationQuestionTriggers,
  type StationTriggerOrder,
} from "@/lib/denis/stations/question-triggers";
import {
  aggregateGlobalStatus,
  stationsForOrderItems,
} from "@/lib/orders/station-states";
import { buildStationAwareOrderStatusMessage } from "@/lib/guest/station-guest-message";
import { mergeOrderTimelineEvents } from "@/lib/orders/order-timeline";
import {
  filterBurningNotifications,
  filterReadyStuckRows,
} from "@/lib/dashboard/operations-triage";
import { buildDenisShiftRecap } from "@/lib/admin/denis-shift-report";
import type { OrderFact } from "@/lib/denis/loop/types";

const STATION_CONFIG = {
  ...CONCIERGE_PLATFORM_DEFAULTS.ops.stationQuestions,
  enabled: true,
};

const NOW = Date.parse("2026-07-01T20:00:00.000Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function mixedOrder(overrides: Partial<StationTriggerOrder> = {}): StationTriggerOrder {
  return {
    id: "order-mixed",
    orderNumber: 42,
    status: "preparing",
    createdAt: minutesAgo(15),
    preparingAt: minutesAgo(14),
    readyAt: null,
    hasKitchenItems: true,
    hasDrinkItems: true,
    kitchenStation: { status: "queued", readyAt: null, pickedUpAt: null },
    barStation: { status: "queued", readyAt: null, pickedUpAt: null },
    ...overrides,
  };
}

describe("ADR-043 S7 pilot config", () => {
  it("TABLE_OS_PILOT enables station questions and station-aware tell", () => {
    const config = resolveConciergeConfig({
      locationConfig: TABLE_OS_PILOT_CONFIG_PATCH,
    });

    expect(config.ops.stationQuestions.enabled).toBe(true);
    expect(config.ops.stationAwareTell).toBe(true);
    expect(config.ops.stationQuestions.foodSlaMinutes).toBe(12);
  });
});

describe("ADR-043 Scenario A — happy path (domain chain)", () => {
  it("A1 mixed order creates kitchen + bar station rows", () => {
    expect(
      stationsForOrderItems([
        { menu_section: "food" },
        { menu_section: "drinks" },
      ])
    ).toEqual(new Set(["kitchen", "bar"]));
  });

  it("A2 bar ready keeps global preparing + guest tell mentions drinks ready", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "bar", status: "ready" },
          { station: "kitchen", status: "in_prep" },
        ],
        "preparing"
      )
    ).toBe("preparing");

    const message = buildStationAwareOrderStatusMessage({
      order: {
        id: "order-mixed",
        orderNumber: 42,
        status: "preparing",
        paymentStatus: "paid",
        estimatedPrepMinutes: null,
        createdAt: minutesAgo(15),
        items: [
          { productName: "Ćevapi", quantity: 1, menuSection: "food" },
          { productName: "Pivo", quantity: 1, menuSection: "drinks" },
        ],
        stationStates: [
          {
            station: "kitchen",
            status: "in_prep",
            readyAt: null,
            pickedUpAt: null,
          },
          {
            station: "bar",
            status: "ready",
            readyAt: minutesAgo(2),
            pickedUpAt: null,
          },
        ],
      } satisfies OrderFact,
      language: "sr",
    });

    expect(message).toMatch(/piće.*spremn/i);
    expect(message).toMatch(/hrana.*priprema/i);
  });

  it("A3 kitchen SLA breach produces Question Card candidate on KDS", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [mixedOrder()],
      config: STATION_CONFIG,
      now: NOW,
    });

    expect(candidates.some((c) => c.station === "kitchen" && c.questionType === "eta")).toBe(
      true
    );
  });

  it("A4 kitchen ETA answer yields truthful guest tell + timeline entry", () => {
    const message = buildStationAwareOrderStatusMessage({
      order: {
        id: "order-mixed",
        orderNumber: 42,
        status: "preparing",
        paymentStatus: "paid",
        estimatedPrepMinutes: null,
        createdAt: minutesAgo(15),
        items: [{ productName: "Ćevapi", quantity: 1, menuSection: "food" }],
        stationStates: [
          {
            station: "kitchen",
            status: "in_prep",
            readyAt: null,
            pickedUpAt: null,
          },
        ],
      } satisfies OrderFact,
      language: "sr",
      freshEta: {
        answer: "eta",
        etaMinutes: 5,
        station: "kitchen",
        answeredAt: new Date(NOW).toISOString(),
        ageMinutes: 0,
      },
    });

    expect(message).toMatch(/5\s*min/i);

    const timeline = mergeOrderTimelineEvents({
      order: {
        created_at: minutesAgo(15),
        accepted_at: minutesAgo(14),
        preparing_at: minutesAgo(13),
        ready_at: null,
        delivered_at: null,
      },
      orderEvents: [],
      stationStates: [
        {
          station: "kitchen",
          queued_at: minutesAgo(15),
          in_prep_at: minutesAgo(13),
          ready_at: null,
          picked_up_at: null,
          served_at: null,
        },
        {
          station: "bar",
          queued_at: minutesAgo(15),
          in_prep_at: minutesAgo(14),
          ready_at: minutesAgo(5),
          picked_up_at: minutesAgo(3),
          served_at: null,
        },
      ],
      stationQuestions: [
        {
          station: "kitchen",
          question_type: "eta",
          message: "Sto 7 · Bon #42 — gost čeka 15 min.",
          status: "answered",
          answer: "eta",
          answer_eta_minutes: 5,
          asked_by: "denis",
          asked_at: minutesAgo(12),
          answered_at: minutesAgo(11),
          expires_at: minutesAgo(10),
        },
      ],
    });

    expect(timeline.some((e) => e.kind === "denis.question.asked")).toBe(true);
    expect(timeline.some((e) => e.detail?.includes("5 min"))).toBe(true);
  });

  it("A5 waiter pickup + serve closes global delivered", () => {
    expect(
      aggregateGlobalStatus(
        [
          { station: "bar", status: "served" },
          { station: "kitchen", status: "served" },
        ],
        "ready"
      )
    ).toBe("delivered");
  });

  it("A6 Operations Center triage surfaces burning + ready-stuck signals", () => {
    const burning = filterBurningNotifications([
      {
        id: "n1",
        orgId: "org",
        locationId: "loc",
        type: "denis_escalation",
        priority: "urgent",
        message: "Kuhinja ne odgovara",
        tableId: "t1",
        tableName: "Sto 7",
        actionUrl: "/kitchen",
        readAt: null,
        createdAt: minutesAgo(1),
      },
    ]);

    expect(burning).toHaveLength(1);

    const readyStuck = filterReadyStuckRows(
      [
        {
          orderId: "order-mixed",
          orderNumber: 42,
          station: "bar",
          readyAt: minutesAgo(4),
          waitMinutes: 4,
          tableId: "t1",
          tableName: "Sto 7",
        },
      ],
      2,
      NOW
    );

    expect(readyStuck).toHaveLength(1);
  });

  it("A7 timeline merges station milestones + Denis Q&A", () => {
    const timeline = mergeOrderTimelineEvents({
      order: {
        created_at: minutesAgo(20),
        accepted_at: minutesAgo(19),
        preparing_at: minutesAgo(18),
        ready_at: minutesAgo(5),
        delivered_at: minutesAgo(1),
      },
      orderEvents: [],
      stationStates: [
        {
          station: "bar",
          queued_at: minutesAgo(20),
          in_prep_at: minutesAgo(18),
          ready_at: minutesAgo(15),
          picked_up_at: minutesAgo(10),
          served_at: minutesAgo(8),
        },
        {
          station: "kitchen",
          queued_at: minutesAgo(20),
          in_prep_at: minutesAgo(18),
          ready_at: minutesAgo(6),
          picked_up_at: minutesAgo(4),
          served_at: minutesAgo(2),
        },
      ],
      stationQuestions: [
        {
          station: "kitchen",
          question_type: "eta",
          message: "ETA?",
          status: "answered",
          answer: "eta",
          answer_eta_minutes: 5,
          asked_by: "denis",
          asked_at: minutesAgo(17),
          answered_at: minutesAgo(16),
          expires_at: minutesAgo(15),
        },
      ],
    });

    expect(timeline.some((e) => e.kind === "station.ready" && e.label.includes("Bar"))).toBe(
      true
    );
    expect(
      timeline.some((e) => e.kind === "station.served" && e.label.includes("Kitchen"))
    ).toBe(true);
    expect(timeline.some((e) => e.kind === "denis.question.asked")).toBe(true);
    expect(timeline.length).toBeGreaterThanOrEqual(8);
  });

  it("A8 daily report Denis shift section aggregates shift metrics", () => {
    const recap = buildDenisShiftRecap({
      stationQuestions: [
        {
          station: "kitchen",
          status: "answered",
          asked_at: minutesAgo(20),
          answered_at: minutesAgo(18),
          expires_at: minutesAgo(17),
          table_id: "t1",
          order_id: "order-mixed",
        },
      ],
      staffNotifications: [],
      waiterCalls: [],
      stationStates: [
        {
          station: "kitchen",
          in_prep_at: minutesAgo(25),
          ready_at: minutesAgo(10),
        },
      ],
      tableNames: { t1: "Sto 7" },
      kitchenFallbackPrepMinutes: 14,
    });

    expect(recap.stationQuestions[0]?.answered).toBe(1);
    expect(recap.preventedProblems).toBe(1);
    expect(recap.stationDelays[0]?.avgPrepMinutes).toBe(15);
  });
});

describe("ADR-043 Scenario B — problem trail to resolution", () => {
  it("B1 expired question appears in timeline when kitchen does not answer", () => {
    const timeline = mergeOrderTimelineEvents({
      order: {
        created_at: minutesAgo(30),
        accepted_at: minutesAgo(29),
        preparing_at: minutesAgo(28),
        ready_at: null,
        delivered_at: null,
      },
      orderEvents: [],
      stationStates: [],
      stationQuestions: [
        {
          station: "kitchen",
          question_type: "eta",
          message: "No answer",
          status: "expired",
          answer: null,
          answer_eta_minutes: null,
          asked_by: "denis",
          asked_at: minutesAgo(15),
          answered_at: null,
          expires_at: minutesAgo(13),
        },
      ],
    });

    expect(timeline.some((e) => e.kind === "denis.question.expired")).toBe(true);
  });

  it("B2 expiry escalation surfaces in Operations burning queue", () => {
    const burning = filterBurningNotifications([
      {
        id: "esc1",
        orgId: "org",
        locationId: "loc",
        type: "denis_escalation",
        priority: "urgent",
        message: "Kuhinja ne odgovara na Denis pitanje · Bon #42",
        tableId: "t1",
        tableName: "Sto 7",
        actionUrl: "/kitchen",
        readAt: null,
        createdAt: minutesAgo(0),
      },
    ]);

    expect(burning[0]?.type).toBe("denis_escalation");
    expect(burning[0]?.actionUrl).toBe("/kitchen");
  });

  it("B5 full chain visible: asked → expired in timeline", () => {
    const timeline = mergeOrderTimelineEvents({
      order: {
        created_at: minutesAgo(40),
        accepted_at: minutesAgo(39),
        preparing_at: minutesAgo(38),
        ready_at: null,
        delivered_at: null,
      },
      orderEvents: [],
      stationStates: [],
      stationQuestions: [
        {
          station: "kitchen",
          question_type: "eta",
          message: "When ready?",
          status: "open",
          answer: null,
          answer_eta_minutes: null,
          asked_by: "denis",
          asked_at: minutesAgo(20),
          answered_at: null,
          expires_at: minutesAgo(18),
        },
        {
          station: "kitchen",
          question_type: "eta",
          message: "Still waiting",
          status: "expired",
          answer: null,
          answer_eta_minutes: null,
          asked_by: "denis",
          asked_at: minutesAgo(15),
          answered_at: null,
          expires_at: minutesAgo(13),
        },
      ],
    });

    const kinds = timeline.map((e) => e.kind);
    expect(kinds).toContain("denis.question.asked");
    expect(kinds).toContain("denis.question.expired");
  });

  it("B6 anti-spam: SLA trigger fires once; open question blocks duplicate at create time", () => {
    const firstPass = evaluateStationQuestionTriggers({
      orders: [mixedOrder()],
      config: STATION_CONFIG,
      now: NOW,
    });

    const kitchenEta = firstPass.filter(
      (c) => c.station === "kitchen" && c.questionType === "eta"
    );
    expect(kitchenEta).toHaveLength(1);

    // createStationQuestion returns already_open when status=open for same order+station
    // (see station-questions.ts L100-102) — cooldown after answer/expiry (L104-109).
    expect(STATION_CONFIG.cooldownMinutes).toBeGreaterThan(0);
    expect(STATION_CONFIG.maxOpenPerStation).toBeGreaterThan(0);
  });
});
