import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { mapFoldToTurnContext } from "@/lib/denis/runtime/map-fold-to-turn-context";
import type {
  DenisChatBody,
  DenisTurnContext,
} from "@/lib/denis/runtime/turn-types";
import {
  loadTableParty,
  registerPartyDevice,
  resolveActiveTableSessionId,
  resolveDraftAiSessionId,
} from "@/lib/denis/venue/party";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Load Denis planning context via FOLD before legacy narrate (M7 + ADR-019 A). */
export async function buildDenisTurnContext(
  admin: SupabaseClient,
  input: DenisChatBody
): Promise<DenisTurnContext> {
  const config = await loadConciergeConfigForLocation(input.locationId);

  const tableSessionId = await resolveActiveTableSessionId(admin, {
    tableId: input.tableId,
    locationId: input.locationId,
    sessionToken: input.sessionToken,
  });

  let party = null;
  if (tableSessionId && input.deviceFingerprint) {
    await registerPartyDevice(admin, {
      tableSessionId,
      locationId: input.locationId,
      tableId: input.tableId,
      deviceFingerprint: input.deviceFingerprint,
      aiSessionId: input.sessionId ?? null,
      manualCartSnapshot: input.manualCartSnapshot ?? null,
      manualCartRevision: input.manualCartSnapshot?.revision ?? 0,
    });

    party = await loadTableParty(admin, {
      tableSessionId,
      partyMode: config.party.mode,
      deviceFingerprint: input.deviceFingerprint,
    });
  }

  const draftAiSessionId = resolveDraftAiSessionId(
    config.party.mode,
    input.sessionId,
    party?.sharedAiSessionId ?? null
  );

  const fold = await foldTableSessionState(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.sessionToken,
    aiSessionId: input.sessionId,
    draftAiSessionId: draftAiSessionId ?? undefined,
    deviceFingerprint: input.deviceFingerprint,
    manualCartSnapshot: input.manualCartSnapshot,
    config,
    tableSessionId,
    party,
  });

  return mapFoldToTurnContext(fold, {
    locationId: input.locationId,
    aiSessionId: input.sessionId,
  });
}
