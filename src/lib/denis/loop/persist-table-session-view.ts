import { publishViewVersionBump } from "@/lib/denis/actor/view-version";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { projectTableSessionView } from "@/lib/denis/loop/project-view";
import { tableSessionViewToScene } from "@/lib/denis/loop/view-to-scene";
import type { TellResult } from "@/lib/denis/loop/view-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/** PROJECT + persist guest_scene from folded Mind (ADR-019 Phase D). */
export async function persistTableSessionView(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    tableId: string;
    locationId: string;
    tableToken: string;
    venueName: string;
    tellResult?: TellResult;
  }
): Promise<number | null> {
  const fold = await foldTableSessionState(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.tableToken,
    tableSessionId: input.sessionId,
  });

  if (!fold.meta.tableSessionId) return null;

  const view = projectTableSessionView(
    fold.state,
    fold.meta,
    input.tellResult ?? null,
    {
      sessionId: input.sessionId,
      venueName: input.venueName,
    }
  );

  const scene = tableSessionViewToScene(
    view,
    fold.state.mental.accessibility ?? null
  );

  const { data: sessionMeta } = await admin
    .from("table_sessions")
    .select("location_id, location:locations!inner(org_id)")
    .eq("id", input.sessionId)
    .maybeSingle();

  const meta = sessionMeta as {
    location_id: string;
    location: { org_id: string };
  } | null;

  if (!meta) return null;

  const { error: upsertError } = await admin.from("guest_scene" as never).upsert(
    {
      session_id: input.sessionId,
      org_id: meta.location.org_id,
      location_id: meta.location_id,
      version: view.version,
      scene: scene as never,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "session_id" }
  );

  if (upsertError) {
    logger.warn("persistTableSessionView failed", {
      sessionId: input.sessionId,
      error: upsertError.message,
    });
    return null;
  }

  await publishViewVersionBump(input.sessionId, view.version);

  return view.version;
}
