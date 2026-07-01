import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { asRecord } from "@/lib/supabase/json";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SceneRefreshOverrides } from "./map-turn-to-scene-overrides";
import { refreshGuestScene } from "./refresh-guest-scene";

export async function enqueueGuestSceneRefresh(
  admin: ReturnType<typeof createAdminClient>,
  overrides: SceneRefreshOverrides
): Promise<void> {
  if (!overrides.sessionId) return;

  await enqueueOutboxEvents(admin, [
    {
      aggregate_type: "session",
      aggregate_id: overrides.sessionId,
      domain: "session",
      event_type: "session.scene.refresh",
      payload: asRecord(overrides),
    },
  ]);
}

/** SC-6 — refresh immediately for guest latency, outbox for retry/idempotency workers. */
export async function scheduleGuestSceneRefresh(
  admin: ReturnType<typeof createAdminClient>,
  overrides: SceneRefreshOverrides
): Promise<void> {
  if (!overrides.sessionId) return;

  try {
    await refreshGuestScene(admin, overrides);
  } catch (error) {
    logger.warn("scene.refresh inline failed; outbox will retry", {
      sessionId: overrides.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await enqueueGuestSceneRefresh(admin, overrides);
}
