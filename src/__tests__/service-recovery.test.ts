import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aggregateServiceRecoveryStats } from "@/lib/admin/denis-shift-report";
import { buildDailyReport, formatDailyReportDigest } from "@/lib/admin/build-daily-report";
import { decideProactiveTurnPlan } from "@/lib/denis/cognition/proactive/decide-proactive-turn-plan";
import { detectOptimalReviewMoment } from "@/lib/denis/cognition/proactive/detect-review-moment";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";
import {
  buildServiceRecoveryStaffMessage,
  SERVICE_RECOVERY_MESSAGE_PREFIX,
  suggestRecoveryGesture,
} from "@/lib/denis/cognition/recovery/build-service-recovery-alert";
import {
  detectServiceRecoveryTrigger,
  isGuestServiceComplaintMessage,
} from "@/lib/denis/cognition/recovery/detect-service-recovery";
import { hasActiveServiceRecovery } from "@/lib/denis/cognition/recovery/service-recovery-timeline";
import { resolveRecoveryActionsForTurn } from "@/lib/denis/runtime/resolve-turn-recovery";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { ServiceRecoveryGesture } from "@/lib/denis/config/concierge-config.schema";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import type { GuestProactiveNudge } from "@/lib/denis/runtime/evaluate-proactive-tick";
import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";
import { filterOpenServiceRecoveryNotifications } from "@/lib/dashboard/operations-triage";

const recoveryGestures: ServiceRecoveryGesture[] = [
  "dessert_on_house",
  "drink_on_house",
  "discount_10",
];

const serviceRecoveryConfig = {
  ...CONCIERGE_PLATFORM_DEFAULTS,
  ops: {
    ...CONCIERGE_PLATFORM_DEFAULTS.ops,
    serviceRecovery: {
      enabled: true,
      gestures: recoveryGestures,
      waitSilenceMinutes: 12,
      reviewBlockMinutes: 120,
    },
  },
};

function minimalTurnCtx(guestMessage: string): DenisTurnContext {
  return {
    config: serviceRecoveryConfig,
    tableSessionState: {
      mental: {
        ...emptyGuestMentalModel(),
        affect: {
          frustration: { level: "none", signals: [] },
          sentiment: { score: -0.6, lastSignals: ["negative_lexicon"] },
        },
      },
      commerce: {
        orders: [
          {
            id: "o1",
            status: "preparing",
            createdAt: new Date(Date.now() - 25 * 60_000).toISOString(),
            orderNumber: 42,
            items: [],
          },
        ],
        cart: buildMergedCart({ ai: emptyCartState() }),
      },
      timeline: [
        {
          id: "tl1",
          ai_session_id: "s1",
          seq: 1,
          trace_id: "trace",
          context_hash: null,
          event_type: "signal.message",
          created_at: new Date(Date.now() - 20 * 60_000).toISOString(),
          payload: { text: guestMessage },
        },
      ],
    },
    foldMeta: { phase: "waiting" },
    venueOps: { staffOnFloor: 2 },
  } as unknown as DenisTurnContext;
}

describe("ADR-043 S12 — service recovery", () => {
  it("detects complaint lexicon and escalates with context fields", () => {
    const message = "Hrana je bila hladna, nezadovoljan sam";
    expect(isGuestServiceComplaintMessage(message)).toBe(true);

    const trigger = detectServiceRecoveryTrigger({
      guestMessage: message,
      affect: {
        frustration: { level: "mild", signals: [] },
        sentiment: { score: -0.4, lastSignals: [] },
      },
      orderLifecycle: {
        isWaiting: true,
        hasOpenOrders: true,
      },
      config: serviceRecoveryConfig.ops.serviceRecovery,
      oldestOpenOrderAgeMinutes: 25,
    });

    expect(trigger.shouldEscalate).toBe(true);
    expect(trigger.triggers).toContain("guest_complaint");
    expect(trigger.complaintSnippet).toContain("hladna");

    const gesture = suggestRecoveryGesture(
      serviceRecoveryConfig.ops.serviceRecovery,
      trigger.triggers,
      "sr"
    );
    expect(gesture).toBe("dessert_on_house");

    const built = buildServiceRecoveryStaffMessage({
      tableName: "Sto 7",
      language: "sr",
      triggers: trigger.triggers,
      complaintSnippet: trigger.complaintSnippet,
      waitMinutes: trigger.waitMinutes,
      recentGuestMessages: [message],
      orderSummary: "Porudžbina #42: preparing",
      gesture,
    });

    expect(built.message).toContain(SERVICE_RECOVERY_MESSAGE_PREFIX);
    expect(built.message).toContain("Sto 7");
    expect(built.message).toContain("hladna");
    expect(built.detail).toContain("SAMO predlog");
  });

  it("complaint turn adds urgent staff escalation when service recovery enabled", () => {
    const guestMessage = "Ovo je užasno, predugo čekam";
    const { actions, serviceRecovery } = resolveRecoveryActionsForTurn({
      ctx: minimalTurnCtx(guestMessage),
      language: "sr",
      guestMessage,
    });

    expect(serviceRecovery?.shouldEscalate).toBe(true);
    const escalation = actions.find((action) => action.kind === "staff_escalation");
    expect(escalation?.urgency).toBe("urgent");
  });

  it("blocks review prompt while active service recovery is open", () => {
    const nowMs = Date.parse("2026-07-01T20:00:00.000Z");
    const timeline = [
      {
        id: "e1",
        ai_session_id: "s1",
        seq: 1,
        trace_id: "trace",
        context_hash: null,
        event_type: "service.recovery.opened",
        created_at: "2026-07-01T19:50:00.000Z",
        payload: { tableId: "t1", triggers: ["guest_complaint"] },
      },
    ] as const;

    expect(
      hasActiveServiceRecovery({
        timeline: [...timeline] as never,
        nowMs,
        blockMinutes: 120,
      })
    ).toBe(true);

    const moment = detectOptimalReviewMoment({
      phase: "settling",
      billSettled: true,
      waitingForBill: true,
      activeServiceRecovery: true,
    });

    expect(moment.blocked).toBe("active_service_recovery");
    expect(moment.moment).toBeNull();
  });

  it("blocks upsell nudges during active service recovery", () => {
    const state: TableSessionState = {
      table: { id: "t1", name: "T1", token: "tok" },
      session: {
        id: "s1",
        status: "active",
        accessState: null,
        billSettled: false,
        feedbackSubmitted: false,
        denisEnabled: true,
        denisActive: true,
      },
      commerce: {
        orders: [],
        cart: buildMergedCart({ ai: emptyCartState() }),
      },
      venue: {
        ops: {
          operatingMode: "normal",
          kdsStress: "normal",
          acceptingOrders: true,
          unavailableProductIds: [],
          staffHint: null,
        },
        opsEffects: {
          skipUpsell: false,
          shortenReplies: false,
          empathyNote: null,
          guestSafeStaffHint: null,
        },
      },
      conversation: {
        flowNodeId: "guest.seated",
        foodUpsellAsked: false,
        dismissedNudges: [],
        lastAssistantMessage: null,
        pendingSlot: null,
        model: emptyConversationModel(),
        obligation: null,
      },
      timeline: [],
      browse: emptyBrowseProfile(),
      mental: emptyGuestMentalModel(),
      offer: emptyGuestOfferContext(),
      config: serviceRecoveryConfig,
    };

    const beliefs = compileBeliefs({
      state,
      guestMessage: "",
    });

    const candidate: GuestProactiveNudge = {
      kind: "dessert_nudge",
      message: "Desert?",
    };

    const result = decideProactiveTurnPlan({
      beliefs,
      candidate,
      sessionPhase: "settling",
      config: serviceRecoveryConfig,
      activeServiceRecovery: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("service_recovery.active");
    }
  });

  it("filters open recovery notifications for Operations Center", () => {
    const rows = filterOpenServiceRecoveryNotifications([
      {
        id: "1",
        orgId: "o",
        locationId: "l",
        type: "denis_escalation",
        priority: "urgent",
        message: `${SERVICE_RECOVERY_MESSAGE_PREFIX} Sto 3 · Signali: guest_complaint`,
        tableId: "t3",
        tableName: "Sto 3",
        actionUrl: "/dashboard/tables",
        readAt: null,
        createdAt: "2026-07-01T19:00:00.000Z",
      },
      {
        id: "2",
        orgId: "o",
        locationId: "l",
        type: "denis_escalation",
        priority: "urgent",
        message: "Pređi na sto 5",
        tableId: "t5",
        tableName: "Sto 5",
        actionUrl: null,
        readAt: null,
        createdAt: "2026-07-01T19:00:00.000Z",
      },
      {
        id: "3",
        orgId: "o",
        locationId: "l",
        type: "denis_escalation",
        priority: "urgent",
        message: `${SERVICE_RECOVERY_MESSAGE_PREFIX} Sto 1`,
        tableId: "t1",
        tableName: "Sto 1",
        actionUrl: null,
        readAt: "2026-07-01T19:30:00.000Z",
        createdAt: "2026-07-01T19:00:00.000Z",
      },
    ]);

    expect(rows.map((row) => row.id)).toEqual(["1"]);
  });

  it("aggregates service recovery stats for daily report digest", () => {
    const stats = aggregateServiceRecoveryStats([
      {
        type: "denis_escalation",
        priority: "urgent",
        table_id: "t1",
        created_at: "2026-07-01T18:00:00.000Z",
        message: `${SERVICE_RECOVERY_MESSAGE_PREFIX} Sto 1`,
        read_at: "2026-07-01T18:08:00.000Z",
      },
      {
        type: "denis_escalation",
        priority: "urgent",
        table_id: "t2",
        created_at: "2026-07-01T19:00:00.000Z",
        message: `${SERVICE_RECOVERY_MESSAGE_PREFIX} Sto 2`,
        read_at: null,
      },
    ]);

    expect(stats.casesOpened).toBe(2);
    expect(stats.resolved).toBe(1);
    expect(stats.unresolved).toBe(1);
    expect(stats.avgManagerResponseMinutes).toBe(8);

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
        staffNotifications: [
          {
            type: "denis_escalation",
            priority: "urgent",
            table_id: "t1",
            created_at: "2026-07-01T18:00:00.000Z",
            message: `${SERVICE_RECOVERY_MESSAGE_PREFIX} Sto 1`,
            read_at: "2026-07-01T18:08:00.000Z",
          },
          {
            type: "denis_escalation",
            priority: "urgent",
            table_id: "t2",
            created_at: "2026-07-01T19:00:00.000Z",
            message: `${SERVICE_RECOVERY_MESSAGE_PREFIX} Sto 2`,
            read_at: null,
          },
        ],
        waiterCalls: [],
        stationStates: [],
        tableNames: {},
        kitchenFallbackPrepMinutes: 14,
      },
    });

    const digest = formatDailyReportDigest(report);
    expect(digest.text).toContain("Service recovery: 2 slučaj");
    expect(digest.text).toContain("Rešeno: 1");
    expect(digest.html).toContain("Service recovery");
  });

  it("gesture path is suggestion-only — no auto-comp in recovery runtime", () => {
    const applySource = readFileSync(
      join(process.cwd(), "src/lib/denis/runtime/apply-frustration-recovery.ts"),
      "utf8"
    );
    const alertSource = readFileSync(
      join(
        process.cwd(),
        "src/lib/denis/cognition/recovery/build-service-recovery-alert.ts"
      ),
      "utf8"
    );

    expect(applySource).not.toMatch(
      /createComp|voidLine|applyDiscount|orders.*update.*comp/i
    );
    expect(alertSource).toContain("SAMO predlog");
    expect(applySource).toContain("emitStaffProactiveAlert");
    expect(applySource).not.toContain("executeOrderSaga");
  });
});
