import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { composeScene } from "./compose-scene";
import { loadComposeSceneInput } from "./load-scene-input";
import type { Scene } from "./types";

type SceneRefreshPayload = {
  sessionId?: string;
  sheetOpen?: boolean;
  thinking?: boolean;
  markState?: "idle" | "listen" | "think";
  proactiveBanner?: {
    id: string;
    message: string;
    action?: "open_sheet" | "add_product" | "dismiss" | "feedback";
    productId?: string;
    productName?: string;
  } | null;
};

export async function refreshGuestScene(
  admin: ReturnType<typeof createAdminClient>,
  payload: SceneRefreshPayload
): Promise<Scene | null> {
  const sessionId = payload.sessionId;
  if (!sessionId) {
    throw new Error("scene.refresh missing sessionId");
  }

  const { data: existing } = await admin
    .from("guest_scene" as never)
    .select("version, org_id, location_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  const existingRow = existing as {
    version?: number;
    org_id?: string;
    location_id?: string;
  } | null;

  const input = await loadComposeSceneInput(admin, sessionId, {
    sheetOpen: payload.sheetOpen,
    thinking: payload.thinking,
    markState: payload.markState,
    proactiveBanner: payload.proactiveBanner ?? undefined,
  });

  if (!input) {
    logger.warn("scene.refresh: session not found", { sessionId });
    return null;
  }

  const nextVersion = (existingRow?.version ?? 0) + 1;
  const scene = composeScene(input, nextVersion);

  const { data: sessionMeta } = await admin
    .from("table_sessions")
    .select("location_id, location:locations!inner(org_id)")
    .eq("id", sessionId)
    .maybeSingle();

  const meta = sessionMeta as {
    location_id: string;
    location: { org_id: string };
  } | null;

  if (!meta) return null;

  const { error: upsertError } = await admin.from("guest_scene" as never).upsert(
    {
      session_id: sessionId,
      org_id: meta.location.org_id,
      location_id: meta.location_id,
      version: nextVersion,
      scene: scene as never,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "session_id" }
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return scene;
}

export async function handleSceneRefresh(
  payload: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  await refreshGuestScene(admin, payload as SceneRefreshPayload);
}

export async function loadGuestSceneBySessionId(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<Scene | null> {
  const { data, error } = await admin
    .from("guest_scene" as never)
    .select("scene")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  return (data as { scene: Scene }).scene;
}
