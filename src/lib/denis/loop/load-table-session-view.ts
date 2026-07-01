import type { SupabaseClient } from "@supabase/supabase-js";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { projectTableSessionView } from "@/lib/denis/loop/project-view";
import type { TableSessionView } from "@/lib/denis/loop/view-types";
import { tableSessionViewToScene } from "@/lib/denis/loop/view-to-scene";
import type { Scene } from "@/lib/scene/types";

export type LoadedTableSessionView = {
  view: TableSessionView;
  scene: Scene;
};

export async function loadTableSessionView(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    tableId: string;
    locationId: string;
    tableToken: string;
    venueName: string;
    language?: string;
  }
): Promise<LoadedTableSessionView | null> {
  const fold = await foldTableSessionState(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.tableToken,
    tableSessionId: input.sessionId,
  });

  if (!fold.meta.tableSessionId) return null;

  const view = projectTableSessionView(fold.state, fold.meta, null, {
    sessionId: input.sessionId,
    venueName: input.venueName,
    language: input.language,
  });

  return {
    view,
    scene: tableSessionViewToScene(view, fold.state.mental.accessibility ?? null),
  };
}
