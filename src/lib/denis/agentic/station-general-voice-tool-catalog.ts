import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenAiToolDefinition } from "@/lib/ai/types";
import { loadStaffCopilotSnapshot } from "@/lib/denis/venue/copilot/load-staff-copilot-snapshot";
import {
  createRelayMessage,
  type RelayStation,
} from "@/lib/denis/stations/station-relay-messages";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";

/**
 * Tool catalog for kitchen/bar staff calling Denis on their own initiative
 * (the "Pozovi Denisa" button — distinct from station-voice-realtime-tool-catalog.ts,
 * which is Denis calling THEM about one specific open station_questions row).
 *
 * get_venue_status reuses the same rich, already-cached snapshot as the
 * owner-voice surface (see owner-voice-tool-catalog.ts) — kitchen/bar staff
 * asking "how's the kitchen" want the same real numbers an owner would get,
 * just without the owner-only remember_restaurant_knowledge tool.
 *
 * notify_station and notify_manager are the two side-effecting tools —
 * Denis relaying something to the OTHER station or escalating to the
 * manager, either because staff explicitly asked ("idi pitaj bar...") or
 * because he judged mid-conversation it was worth flagging on his own
 * (the calling route's instructions grant him that latitude explicitly:
 * being activated means permission to act, not just to answer).
 */

export type StationGeneralVoiceToolName =
  | "get_venue_status"
  | "notify_station"
  | "notify_manager";

export type StationGeneralVoiceToolExecutorInput = {
  admin: SupabaseClient;
  locationId: string;
  orgId: string;
  staffId: string;
  staffRole: string;
  station: RelayStation;
};

function otherStation(station: RelayStation): RelayStation {
  return station === "kitchen" ? "bar" : "kitchen";
}

const getVenueStatus: OpenAiToolDefinition = {
  name: "get_venue_status",
  description:
    "Get this venue's current live status right now: kitchen backlog/stress, active order count, and which tables need attention. Always call this before answering any question about how service is going, whether the kitchen is behind, or which tables have issues — never guess or answer from memory.",
  parameters: { type: "object", properties: {}, required: [] },
};

const notifyStation: OpenAiToolDefinition = {
  name: "notify_station",
  description:
    "Relay a message to the OTHER station (kitchen if you're on this call with bar, bar if you're on this call with kitchen). It will be spoken there automatically, and their reply comes back to you here as a separate spoken update once they answer. Use this whenever staff asks you to check something with the other station, or when you judge on your own that they should know something right now.",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description:
          "The message to relay, phrased naturally as you'd actually say it out loud to them — not a raw transcript of what staff told you.",
      },
    },
    required: ["message"],
  },
};

const notifyManager: OpenAiToolDefinition = {
  name: "notify_manager",
  description:
    "Send the manager a written alert (with a push notification) about something from this conversation. Use this when staff explicitly asks you to tell the manager something, or when you judge on your own that this is worth the manager knowing about soon, not just between you and the station.",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The alert text, written clearly and briefly for the manager to read.",
      },
    },
    required: ["message"],
  },
};

export function listStationGeneralVoiceToolDefinitions(): OpenAiToolDefinition[] {
  return [getVenueStatus, notifyStation, notifyManager];
}

export function isStationGeneralVoiceToolName(
  name: string
): name is StationGeneralVoiceToolName {
  return (
    name === "get_venue_status" ||
    name === "notify_station" ||
    name === "notify_manager"
  );
}

export async function executeStationGeneralVoiceTool(
  name: StationGeneralVoiceToolName,
  input: StationGeneralVoiceToolExecutorInput,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  if (name === "get_venue_status") {
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

  if (name === "notify_station") {
    const message = typeof args.message === "string" ? args.message.trim() : "";
    if (!message) return { ok: false, error: "empty_message" };

    const result = await createRelayMessage(input.admin, {
      locationId: input.locationId,
      fromStation: input.station,
      toStation: otherStation(input.station),
      message,
      requestedByStaffId: input.staffId,
    });

    return result.created
      ? { ok: true, relayId: result.relay.id }
      : { ok: false, error: result.reason };
  }

  // notify_manager
  const message = typeof args.message === "string" ? args.message.trim() : "";
  if (!message) return { ok: false, error: "empty_message" };

  const { delivered } = await dispatchStaffNotification({
    orgId: input.orgId,
    locationId: input.locationId,
    type: "denis_relay",
    message,
  });

  return { ok: true, delivered };
}
