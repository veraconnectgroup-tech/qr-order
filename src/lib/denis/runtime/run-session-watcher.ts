import { loadGuestOrdersForAi } from "@/lib/ai/order-context";
import { detectStaffProactiveAlerts } from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import { loadProactiveMenuHints } from "@/lib/denis/cognition/proactive/load-proactive-menu-hints";
import { buildSessionWatcherContext } from "@/lib/denis/cognition/proactive/session-watcher-context";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { deriveFoldSessionPhase } from "@/lib/denis/loop/derive-fold-phase";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { emitProactiveNudge } from "@/lib/denis/runtime/emit-proactive-nudge";
import { emitStaffProactiveAlert } from "@/lib/denis/runtime/emit-staff-proactive-alert";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { notifyLocationPush } from "@/lib/push/notify-location";
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
  location: { name: string } | { name: string }[] | null;
};

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

const WATCHER_LOOKBACK_HOURS = 6;

/** Server-side session watcher — proactive guest nudges + staff alerts (60s cron). */
export async function runSessionWatcherTick(
  admin: SupabaseClient,
  options?: { limit?: number }
): Promise<SessionWatcherTickResult> {
  const limit = options?.limit ?? 80;
  const since = new Date(
    Date.now() - WATCHER_LOOKBACK_HOURS * 60 * 60 * 1000
  ).toISOString();

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
      location:locations(name)
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
  const hintsByLocation = new Map<
    string,
    Awaited<ReturnType<typeof loadProactiveMenuHints>>
  >();
  const configByLocation = new Map<
    string,
    Awaited<ReturnType<typeof loadConciergeConfigForLocation>>
  >();

  let guestNudges = 0;
  let staffAlerts = 0;
  let skipped = 0;

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

      let hints = hintsByLocation.get(row.location_id);
      if (!hints) {
        hints = await loadProactiveMenuHints(admin, row.location_id);
        hintsByLocation.set(row.location_id, hints);
      }

      const aiSessionId = row.denis_shared_ai_session_id;
      const tableName = relationName(row.table)?.trim() || "—";
      const venueName = relationName(row.location)?.trim() || "Venue";

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
      });

      const emitted = new Set([
        ...watcherContext.emittedKeys,
        ...watcherContext.dismissedNudgeKeys,
      ]);

      const nudge = await emitProactiveNudge(admin, {
        aiSessionId,
        tableSessionId: row.id,
        tableId: row.table_id,
        locationId: row.location_id,
        sessionToken: row.session_token,
        venueName,
        config,
        state: fold.state,
        orders,
        sessionPhase: deriveFoldSessionPhase({
          sessionStatus: fold.state.session.status,
          accessState: fold.state.session.accessState,
          orders: fold.state.commerce.orders,
          hasCartActivity: fold.state.commerce.cart.visibleLines.length > 0,
          billSettled: fold.state.session.billSettled,
        }),
        source: "session.watcher",
        payload: {
          dismissedNudgeKeys: watcherContext.dismissedNudgeKeys,
          hasSessionOrders: fold.state.commerce.orders.length > 0,
          cartItemCount: fold.state.commerce.cart.visibleLines.length,
          sessionAgeSeconds: watcherContext.sessionAgeSeconds,
          guestMessageCount: watcherContext.guestMessageCount,
          idleMinutes: watcherContext.idleMinutes,
          guestAskedRecommendation: watcherContext.guestAskedRecommendation,
          popularityPair: hints.popularityPair,
          todaySpecial: hints.todaySpecial,
          dessertProductName: hints.dessertProductName,
          browseMinutes: watcherContext.idleMinutes,
          venueName,
          language: config.language.venueDefault ?? "sr",
          browsingDeferredAt: watcherContext.browsingDeferredAt,
          browsingDeferCount: watcherContext.browsingDeferCount,
          browseFollowUpEmitted: watcherContext.browseFollowUpEmitted,
        },
      });

      if (nudge) {
        guestNudges += 1;

        if (nudge.kind === "order_delay" && nudge.orderId) {
          await notifyLocationPush(row.location_id, {
            title: "Narudžbina kasni",
            body: `Sto ${tableName} — porudžbina u pripremi duže od ${config.proactive.orderDelayMinutes} min.`,
            url: "/dashboard/kitchen",
          });
        }
      }

      const staffAlertsForSession = detectStaffProactiveAlerts({
        config,
        tableName,
        idleMinutes: watcherContext.idleMinutes,
        emittedKeys: [...emitted],
        recentGuestMessages: watcherContext.recentGuestMessages,
        waiterEscalated: watcherContext.waiterEscalated,
      });

      for (const alert of staffAlertsForSession) {
        if (emitted.has(alert.kind)) continue;
        await emitStaffProactiveAlert(admin, {
          locationId: row.location_id,
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

  return {
    scanned: rows.length,
    guestNudges,
    staffAlerts,
    skipped,
  };
}
