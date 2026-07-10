import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenAiToolDefinition } from "@/lib/ai/types";
import { loadStaffCopilotSnapshot } from "@/lib/denis/venue/copilot/load-staff-copilot-snapshot";

/**
 * Tool catalog for kitchen/bar staff calling Denis on their own initiative
 * (the "Pozovi Denisa" button — distinct from station-voice-realtime-tool-catalog.ts,
 * which is Denis calling THEM about one specific open station_questions row).
 * Read-only by design: this conversation has no pending question to resolve,
 * so there's nothing here for resolve_station_question to act on.
 *
 * get_venue_status reuses the same rich, already-cached snapshot as the
 * owner-voice surface (see owner-voice-tool-catalog.ts) — kitchen/bar staff
 * asking "how's the kitchen" want the same real numbers an owner would get,
 * just without the owner-only remember_restaurant_knowledge tool.
 */

export type StationGeneralVoiceToolName = "get_venue_status";

export type StationGeneralVoiceToolExecutorInput = {
  admin: SupabaseClient;
  locationId: string;
  staffRole: string;
};

const getVenueStatus: OpenAiToolDefinition = {
  name: "get_venue_status",
  description:
    "Get this venue's current live status right now: kitchen backlog/stress, active order count, and which tables need attention. Always call this before answering any question about how service is going, whether the kitchen is behind, or which tables have issues — never guess or answer from memory.",
  parameters: { type: "object", properties: {}, required: [] },
};

export function listStationGeneralVoiceToolDefinitions(): OpenAiToolDefinition[] {
  return [getVenueStatus];
}

export function isStationGeneralVoiceToolName(
  name: string
): name is StationGeneralVoiceToolName {
  return name === "get_venue_status";
}

export async function executeStationGeneralVoiceTool(
  name: StationGeneralVoiceToolName,
  input: StationGeneralVoiceToolExecutorInput
): Promise<unknown> {
  const snapshot = await loadStaffCopilotSnapshot(input.admin, {
    locationId: input.locationId,
    staffRole: input.staffRole,
  });

  return {
    operatingMode: snapshot.operatingMode,
    kdsStress: snapshot.kdsStress,
    kdsBacklogMinutes: snapshot.kdsBacklogMinutes,
    activeOrderCount: snapshot.activeOrderCount,
    rushModeSuggestion: snapshot.rushModeSuggestion,
    tablesNeedingAttention: snapshot.priorityTables.map((table) => ({
      tableName: table.tableName,
      priority: table.priority,
      guestWaitMinutes: table.guestWaitMinutes,
      openOrderCount: table.openOrderCount,
      staffBrief: table.staffBrief,
    })),
  };
}
