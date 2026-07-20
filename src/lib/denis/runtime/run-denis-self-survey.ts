import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiRedis } from "@/lib/ai/redis";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { assessVenueSurvey } from "@/lib/denis/cognition/perceive/assess-venue-survey";
import { createMission } from "@/lib/denis/missions/create-mission";
import { listDueCommitments } from "@/lib/denis/stations/denis-commitments";
import type { VenueSurveySnapshot } from "@/lib/denis/venue/venue-survey-types";
import { logger } from "@/lib/logger";

type LocationRow = { id: string; org_id: string };

const ACTIVE_ORDER_STATUSES = ["pending", "accepted", "preparing"] as const;

function selfSurveyDedupeKey(locationId: string): string {
  return `ai:self-survey:${locationId}`;
}

async function shouldRunSurvey(
  locationId: string,
  cooldownMinutes: number
): Promise<boolean> {
  const redis = getAiRedis();
  if (!redis) return true;

  const key = selfSurveyDedupeKey(locationId);
  const existing = await redis.get<string>(key);
  if (existing) return false;

  await redis.set(key, "1", { ex: cooldownMinutes * 60 });
  return true;
}

/**
 * Venue-wide snapshot — deliberately simpler than kitchen-load-model.ts's
 * per-station breakdown (that's food-station-specific and doesn't cover
 * bar). This just needs coarse counts to hand an LLM for judgment, not a
 * precise prep-time model.
 */
async function assembleVenueSurveySnapshot(
  admin: SupabaseClient,
  locationId: string
): Promise<VenueSurveySnapshot> {
  const [
    { data: orderRows },
    { data: missionRows },
    { count: activeTableCount },
    dueCommitments,
  ] = await Promise.all([
    admin
      .from("orders")
      .select("id, status, order_items(menu_section, quantity)")
      .eq("location_id", locationId)
      .in("status", ACTIVE_ORDER_STATUSES),
    admin
      .from("denis_missions")
      .select("title")
      .eq("location_id", locationId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(10),
    admin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .eq("status", "active"),
    listDueCommitments(admin, {
      locationId,
      today: new Date().toISOString().slice(0, 10),
    }),
  ]);

  let kitchenQueueDepth = 0;
  let barQueueDepth = 0;
  type OrderItemRow = { menu_section: string; quantity: number | null };
  for (const order of (orderRows ?? []) as Array<{
    order_items?: OrderItemRow[] | null;
  }>) {
    for (const item of order.order_items ?? []) {
      const qty = Math.max(1, item.quantity ?? 1);
      if (item.menu_section === "drinks") barQueueDepth += qty;
      else kitchenQueueDepth += qty;
    }
  }

  const overloadedStation =
    kitchenQueueDepth > 15 && kitchenQueueDepth >= barQueueDepth
      ? "kitchen"
      : barQueueDepth > 15
        ? "bar"
        : null;

  const openMissionTitles = ((missionRows ?? []) as Array<{ title: string }>).map(
    (row) => row.title
  );

  return {
    locationId,
    kitchenQueueDepth,
    kitchenRushMode: kitchenQueueDepth > 15,
    barQueueDepth,
    overloadedStation,
    openMissionCount: openMissionTitles.length,
    openMissionTitles,
    overdueCommitmentCount: dueCommitments.length,
    activeTableCount: activeTableCount ?? 0,
  };
}

export type SelfSurveyTickResult = {
  locationsChecked: number;
  surveyed: number;
  missionsCreated: number;
  skippedCooldown: number;
};

/**
 * Denis's own self-directed check on venue state — the one proactive
 * mechanism in this codebase that isn't a fixed time-offset trigger or a
 * response to a guest/staff message. Runs from the scheduler cron, not
 * from any turn. Off by default per location (ops.selfSurvey.enabled) —
 * see ConciergeSelfSurveySchema for why.
 */
export async function runDenisSelfSurveyTick(
  admin: SupabaseClient
): Promise<SelfSurveyTickResult> {
  const { data: locations, error } = await admin
    .from("locations")
    .select("id, org_id")
    .eq("is_active", true);

  if (error || !locations?.length) {
    return { locationsChecked: 0, surveyed: 0, missionsCreated: 0, skippedCooldown: 0 };
  }

  let surveyed = 0;
  let missionsCreated = 0;
  let skippedCooldown = 0;

  for (const location of locations as LocationRow[]) {
    try {
      const config = await loadConciergeConfigForLocation(location.id);
      if (!config.ops.selfSurvey.enabled) continue;

      const canRun = await shouldRunSurvey(
        location.id,
        config.ops.selfSurvey.cooldownMinutes
      );
      if (!canRun) {
        skippedCooldown += 1;
        continue;
      }

      const snapshot = await assembleVenueSurveySnapshot(admin, location.id);
      surveyed += 1;

      const decision = await assessVenueSurvey(snapshot);
      if (!decision) continue;

      logger.info("Denis self-survey", {
        locationId: location.id,
        needsAttention: decision.needsAttention,
        reasoning: decision.reasoning,
      });

      if (!decision.needsAttention || !decision.title || !decision.summary) {
        continue;
      }

      const result = await createMission(admin, {
        kind: "custom",
        orgId: location.org_id,
        locationId: location.id,
        title: decision.title,
        summary: decision.summary,
        priority: decision.urgency === "urgent" ? "urgent" : "normal",
        payload: {
          selfInitiated: true,
          reasoning: decision.reasoning,
          snapshot,
        },
      });

      if (result.created) missionsCreated += 1;
    } catch (locationError) {
      logger.warn("runDenisSelfSurveyTick location failed", {
        locationId: location.id,
        error:
          locationError instanceof Error
            ? locationError.message
            : String(locationError),
      });
    }
  }

  return {
    locationsChecked: locations.length,
    surveyed,
    missionsCreated,
    skippedCooldown,
  };
}
