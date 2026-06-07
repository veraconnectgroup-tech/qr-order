import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { ensureSharedAiSessionForTableSession } from "@/lib/denis/loop/ensure-shared-ai-session";
import { foldTableSessionState } from "@/lib/denis/loop/fold-table-session-state";
import { mapFoldToTurnContext } from "@/lib/denis/runtime/map-fold-to-turn-context";
import type {
  DenisChatBody,
  DenisTurnContext,
} from "@/lib/denis/runtime/turn-types";
import {
  loadDenisSharedAiSessionId,
  loadTableParty,
  registerPartyDevice,
  resolveActiveTableSessionId,
  resolveDraftAiSessionId,
  resolveGuestTableSessionLookupToken,
} from "@/lib/denis/venue/party";
import { trustSessionDevice } from "@/lib/sessions/session-devices";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Load Denis planning context via FOLD before legacy narrate (M7 + ADR-019 A). */
export async function buildDenisTurnContext(
  admin: SupabaseClient,
  input: DenisChatBody
): Promise<DenisTurnContext> {
  const config = await loadConciergeConfigForLocation(input.locationId);

  const guestTableSessionToken = resolveGuestTableSessionLookupToken(input);

  const tableSessionId = await resolveActiveTableSessionId(admin, {
    tableId: input.tableId,
    locationId: input.locationId,
    sessionToken: guestTableSessionToken,
  });

  if (tableSessionId && config.enabled) {
    const { data: venueRow } = await admin
      .from("locations")
      .select("organization:organizations!inner(id)")
      .eq("id", input.locationId)
      .maybeSingle();

    const orgId = (
      venueRow as { organization?: { id?: string } } | null
    )?.organization?.id;

    if (orgId) {
      await ensureSharedAiSessionForTableSession(admin, {
        sessionId: tableSessionId,
        locationId: input.locationId,
        tableId: input.tableId,
        tableToken: input.sessionToken,
        orgId,
        language: input.language ?? config.language.venueDefault ?? "de",
      });
    }
  }

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

    try {
      await trustSessionDevice(admin, {
        sessionId: tableSessionId,
        deviceFingerprint: input.deviceFingerprint,
      });
    } catch {
      // Non-fatal — ACL submit retries trust on confirm.
    }
  }

  const sharedAiSessionId =
    party?.sharedAiSessionId ??
    (tableSessionId
      ? await loadDenisSharedAiSessionId(admin, tableSessionId)
      : null);

  const draftAiSessionId = resolveDraftAiSessionId(
    config.party.mode,
    input.sessionId,
    sharedAiSessionId
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
