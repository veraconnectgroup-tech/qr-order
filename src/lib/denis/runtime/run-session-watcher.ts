import { loadGuestOrdersForAi } from "@/lib/ai/order-context";
import { detectStaffProactiveAlerts } from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import {
  detectTableTempoPhase,
  findDrinksTempoNudgeEmittedAt,
  tableTempoDedupeKey,
} from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import { hasActiveDrinkOrder } from "@/lib/denis/cognition/proactive/triggers";
import {
  maxKitchenWaitMinutesForTable,
  type KitchenTableWait,
} from "@/lib/denis/cognition/proactive/triggers";
import { buildSessionWatcherContext } from "@/lib/denis/cognition/proactive/session-watcher-context";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { buildSessionExperienceScore } from "@/lib/denis/commerce/session-experience-score";
import { maybeAppendMentalModelUpdated } from "@/lib/denis/cognition/mental-model/append-mental-model-event";
import { maybeAppendOfferResolved } from "@/lib/denis/cognition/offer/append-offer-event";
import { maybeAppendOfferConverted } from "@/lib/denis/cognition/offer/append-offer-converted";
import { maybeAppendNudgeOutcomes } from "@/lib/denis/cognition/offer/append-nudge-outcome";
import { scheduleDenisAnticipationCommerceProjection } from "@/lib/denis/runtime/schedule-denis-anticipation-commerce";
import { scheduleNudgeOutcomeCommerceProjection } from "@/lib/denis/runtime/schedule-nudge-outcome-commerce";
import { enqueueOrRunProactiveSessionTick } from "@/lib/denis/runtime/enqueue-or-run-proactive-tick";
import { emitStaffProactiveAlert } from "@/lib/denis/runtime/emit-staff-proactive-alert";
import {
  expireStationQuestions,
  expireStaleStationQuestionsGlobally,
  runStationQuestionTriggersForSession,
} from "@/lib/denis/stations/station-questions";
import { escalateAllOverdueBusTableObligations } from "@/lib/denis/cognition/waiter/bus-table-obligation";
import { escalateAllOverdueMissions } from "@/lib/denis/missions/escalate-overdue-missions";
import { expireOverduePendingRestaurantKnowledge } from "@/lib/denis/knowledge/restaurant-knowledge-store";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import {
  appendDenisTimelineEvent,
  loadDenisTimeline,
} from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActiveSessionRow = {
  id: string;
  table_id: string;
  location_id: string;
  session_token: string;
  opened_at: string;
  denis_shared_ai_session_id: string;
  table: { name: string } | { name: string }[] | null;
  location:
    | { name: string; org_id: string }
    | { name: string; org_id: string }[]
    | null;
};

function relationOrgId(
  relation:
    | { name: string; org_id: string }
    | { name: string; org_id: string }[]
    | null
    | undefined
): string | null {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.org_id ?? null;
  return relation.org_id ?? null;
}

function relationName(
  relation: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.name ?? null;
  return relation.name ?? null;
}

export type SessionWatcherTickResult = {
  scanned: number;
  guestNudges: number;
  staffAlerts: number;
  skipped: number;
};

const WATCHER_LOOKBACK_HOURS = 24;

/** Server-side session watcher — proactive guest nudges + staff alerts (60s cron). */
export async function runSessionWatcherTick(
  admin: SupabaseClient,
  options?: { limit?: number }
): Promise<SessionWatcherTickResult> {
  const limit = options?.limit ?? 80;
  const since = new Date(
    Date.now() - WATCHER_LOOKBACK_HOURS * 60 * 60 * 1000
  ).toISOString();

  await expireStaleStationQuestionsGlobally(admin);

  const { data: sessions, error } = await admin
    .from("table_sessions")
    .select(
      `
      id,
      table_id,
      location_id,
      session_token,
      opened_at,
      denis_shared_ai_session_id,
      table:tables(name),
      location:locations(name, org_id)
    `
    )
    .eq("status", "active")
    .gte("opened_at", since)
    .not("denis_shared_ai_session_id", "is", null)
    .order("opened_at", { ascending: true })
    .limit(limit);

  if (error) {
    logger.warn("runSessionWatcherTick load failed", { error: error.message });
    return { scanned: 0, guestNudges: 0, staffAlerts: 0, skipped: 0 };
  }

  const rows = (sessions ?? []) as ActiveSessionRow[];
  const configByLocation = new Map<
    string,
    Awaited<ReturnType<typeof loadConciergeConfigForLocation>>
  >();

  let guestNudges = 0;
  let staffAlerts = 0;
  let skipped = 0;
  const kitchenWaitsByLocation = new Map<string, KitchenTableWait[]>();
  const kitchenEscalationEmitted = new Set<string>();
  const stationQuestionLocations = new Set<string>();

  for (const row of rows) {
    try {
      let config = configByLocation.get(row.location_id);
      if (!config) {
        config = await loadConciergeConfigForLocation(row.location_id);
        configByLocation.set(row.location_id, config);
      }

      if (!config.proactive.enabled) {
        skipped += 1;
        continue;
      }

      const aiSessionId = row.denis_shared_ai_session_id;
      const tableName = relationName(row.table)?.trim() || "—";
      const orgId = relationOrgId(row.location);

      const [timeline, orders, fold] = await Promise.all([
        loadDenisTimeline(admin, aiSessionId),
        loadGuestOrdersForAi(admin, row.table_id, row.session_token),
        foldTableSessionState(admin, {
          locationId: row.location_id,
          tableId: row.table_id,
          sessionToken: row.session_token,
          tableSessionId: row.id,
          aiSessionId,
          config,
        }),
      ]);

      const watcherContext = buildSessionWatcherContext({
        timeline,
        orders,
        sessionOpenedAt: row.opened_at,
        venueDefaultLanguage: config.language.venueDefault ?? "sr",
      });

      if (config.ops.stationQuestions.enabled) {
        stationQuestionLocations.add(row.location_id);
        await runStationQuestionTriggersForSession(admin, {
          locationId: row.location_id,
          tableId: row.table_id,
          tableName,
          orders: fold.state.commerce.orders,
          config,
        });
      }

      const tableWaitMinutes = Math.floor(maxKitchenWaitMinutesForTable(orders));
      if (tableWaitMinutes > 0) {
        const bucket = kitchenWaitsByLocation.get(row.location_id) ?? [];
        bucket.push({
          tableId: row.table_id,
          tableName,
          waitMinutes: tableWaitMinutes,
        });
        kitchenWaitsByLocation.set(row.location_id, bucket);
      }

      const emitted = new Set([
        ...watcherContext.emittedKeys,
        ...watcherContext.dismissedNudgeKeys,
      ]);

      const watcherTraceId = createTurnTraceId();
      await maybeAppendMentalModelUpdated(admin, {
        aiSessionId,
        traceId: watcherTraceId,
        timeline: fold.state.timeline,
        mental: fold.state.mental,
        contextHash: fold.meta.truthHash,
      });
      await maybeAppendOfferResolved(admin, {
        aiSessionId,
        traceId: watcherTraceId,
        timeline: fold.state.timeline,
        offer: fold.state.offer,
        contextHash: fold.meta.truthHash,
      });
      const converted = await maybeAppendOfferConverted(admin, {
        aiSessionId,
        traceId: watcherTraceId,
        timeline: fold.state.timeline,
        contextHash: fold.meta.truthHash,
      });
      const nudgeOutcomes = await maybeAppendNudgeOutcomes(admin, {
        aiSessionId,
        traceId: watcherTraceId,
        timeline: fold.state.timeline,
        contextHash: fold.meta.truthHash,
      });
      if (nudgeOutcomes.length > 0) {
        scheduleNudgeOutcomeCommerceProjection(admin, {
          aiSessionId,
          tableSessionId: row.id,
          traceId: watcherTraceId,
          outcomes: nudgeOutcomes,
        });
      }
      if (converted.length > 0) {
        scheduleDenisAnticipationCommerceProjection(admin, {
          kind: "offer_converted",
          aiSessionId,
          tableSessionId: fold.meta.tableSessionId ?? undefined,
          traceId: watcherTraceId,
          conversions: converted,
        });
      }

      const tableTempoPhase = config.ops.tableTempo.enabled
        ? detectTableTempoPhase({
            sessionOpenedAt: row.opened_at,
            orders: fold.state.commerce.orders,
            guestMessageCount: watcherContext.guestMessageCount,
            idleMinutes: watcherContext.idleMinutes,
            config: config.ops.tableTempo,
          })
        : "none";

      if (
        tableTempoPhase === "post_meal_idle" &&
        !watcherContext.emittedKeys.includes(
          tableTempoDedupeKey("post_meal_idle")
        )
      ) {
        await appendDenisTimelineEvent(admin, {
          aiSessionId,
          eventType: "table.tempo.phase",
          traceId: watcherTraceId,
          payload: {
            type: "table.tempo.phase",
            phase: "post_meal_idle",
            source: "session.watcher",
          },
        });
      }

      const nudge = await enqueueOrRunProactiveSessionTick(admin, {
        tableSessionId: row.id,
        source: "session.watcher",
        traceId: watcherTraceId,
        preambleDone: true,
        config,
      });

      if (nudge) {
        guestNudges += 1;

        if (
          (nudge.kind === "order_delay" || nudge.kind === "order_eta_update") &&
          nudge.orderId
        ) {
          await dispatchStaffNotification({
            orgId: orgId ?? undefined,
            locationId: row.location_id,
            type: "long_wait",
            tableId: row.table_id,
            tableName,
            message: `Porudžbina u pripremi duže od ${config.proactive.orderDelayMinutes} min.`,
            actionUrl: "/kitchen",
          });
        }
      }

      const staffAlertsForSession = detectStaffProactiveAlerts({
        config,
        tableName,
        idleMinutes: watcherContext.idleMinutes,
        hasSessionOrders: orders.some((order) => order.status !== "cancelled"),
        guestMessageCount: watcherContext.guestMessageCount,
        hasKitchenResponse: orders.some((order) =>
          ["pending", "pending_approval", "accepted", "preparing", "ready", "delivered"].includes(
            order.status
          )
        ),
        emittedKeys: [...emitted],
        recentGuestMessages: watcherContext.recentGuestMessages,
        waiterEscalated: watcherContext.waiterEscalated,
        guestAffect: fold.state.mental?.affect ?? null,
        kitchenTableWaits: kitchenWaitsByLocation.get(row.location_id),
        experienceScore: buildSessionExperienceScore(fold.state).overallScore,
        language: fold.state.guest?.preferredLanguage ?? null,
        tableTempoPhase,
        dismissedNudgeKeys: watcherContext.dismissedNudgeKeys,
        hasActiveDrinkOrder: hasActiveDrinkOrder(orders),
        drinksNudgeEmittedAtMs: findDrinksTempoNudgeEmittedAt(timeline),
        nowMs: Date.now(),
      });

      for (const alert of staffAlertsForSession) {
        if (alert.kind === "staff_multi_table_delay" || alert.kind === "staff_kitchen_delay") {
          if (kitchenEscalationEmitted.has(row.location_id)) continue;
          kitchenEscalationEmitted.add(row.location_id);
        } else if (emitted.has(alert.kind)) {
          continue;
        }
        if (alert.kind === "staff_multi_table_delay" || alert.kind === "staff_kitchen_delay") {
          await dispatchStaffNotification({
            orgId: orgId ?? undefined,
            locationId: row.location_id,
            type: "kitchen_backup",
            tableId: row.table_id,
            tableName,
            message: alert.message,
            actionUrl: "/kitchen",
          });
        }

        await emitStaffProactiveAlert(admin, {
          locationId: row.location_id,
          orgId: orgId ?? undefined,
          aiSessionId,
          tableId: row.table_id,
          alert,
        });
        staffAlerts += 1;
        emitted.add(alert.kind);
      }
    } catch (watchError) {
      skipped += 1;
      logger.warn("runSessionWatcherTick session failed", {
        tableSessionId: row.id,
        error:
          watchError instanceof Error ? watchError.message : String(watchError),
      });
    }
  }

  for (const locationId of stationQuestionLocations) {
    try {
      await expireStationQuestions(admin, { locationId });
    } catch (expireError) {
      logger.warn("station question expiry failed", {
        locationId,
        error:
          expireError instanceof Error
            ? expireError.message
            : String(expireError),
      });
    }
  }

  try {
    await escalateAllOverdueBusTableObligations(admin);
  } catch (busError) {
    logger.warn("bus table escalation failed", {
      error: busError instanceof Error ? busError.message : String(busError),
    });
  }

  try {
    await escalateAllOverdueMissions(admin);
  } catch (missionError) {
    logger.warn("mission escalation failed", {
      error:
        missionError instanceof Error ? missionError.message : String(missionError),
    });
  }

  try {
    await expireOverduePendingRestaurantKnowledge(admin);
  } catch (expireRuleError) {
    logger.warn("restaurant knowledge proposal expiry failed", {
      error:
        expireRuleError instanceof Error
          ? expireRuleError.message
          : String(expireRuleError),
    });
  }

  return {
    scanned: rows.length,
    guestNudges,
    staffAlerts,
    skipped,
  };
}
