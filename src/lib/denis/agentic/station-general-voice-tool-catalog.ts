import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenAiToolDefinition } from "@/lib/ai/types";
import { loadStaffCopilotSnapshot } from "@/lib/denis/venue/copilot/load-staff-copilot-snapshot";
import {
  createRelayMessage,
  type RelayStation,
} from "@/lib/denis/stations/station-relay-messages";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import {
  completeCommitment,
  createCommitment,
} from "@/lib/denis/stations/denis-commitments";

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
  | "notify_manager"
  | "remember_commitment"
  | "complete_commitment";

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

const rememberCommitment: OpenAiToolDefinition = {
  name: "remember_commitment",
  description:
    "Call this the moment you promise staff you'll do something later — 'javicu sutra', 'proveravam prekosutra', anything with a real timeframe, not something you're doing right now in this same call. You'll be reminded automatically once it's due — you don't need to be asked again.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "What you promised, written as a short standalone reminder to yourself.",
      },
      dueDate: {
        type: "string",
        description:
          "The date you promised to do this, as YYYY-MM-DD — resolve relative terms like 'sutra' or 'prekosutra' yourself using today's date from your instructions.",
      },
    },
    required: ["text", "dueDate"],
  },
};

const completeCommitmentTool: OpenAiToolDefinition = {
  name: "complete_commitment",
  description:
    "Call this once you've actually done something you previously promised (it will have been listed for you at the start of this conversation if it was due). Mark it done so you don't bring it up again.",
  parameters: {
    type: "object",
    properties: {
      commitmentId: {
        type: "string",
        description: "The id of the commitment, from the list you were given at the start of this conversation.",
      },
    },
    required: ["commitmentId"],
  },
};

export function listStationGeneralVoiceToolDefinitions(): OpenAiToolDefinition[] {
  return [
    getVenueStatus,
    notifyStation,
    notifyManager,
    rememberCommitment,
    completeCommitmentTool,
  ];
}

export function isStationGeneralVoiceToolName(
  name: string
): name is StationGeneralVoiceToolName {
  return (
    name === "get_venue_status" ||
    name === "notify_station" ||
    name === "notify_manager" ||
    name === "remember_commitment" ||
    name === "complete_commitment"
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

  if (name === "notify_manager") {
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

  if (name === "remember_commitment") {
    const text = typeof args.text === "string" ? args.text.trim() : "";
    const dueDate = typeof args.dueDate === "string" ? args.dueDate.trim() : "";
    if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return { ok: false, error: "invalid_input" };
    }

    const result = await createCommitment(input.admin, {
      locationId: input.locationId,
      text,
      dueDate,
      station: input.station,
      promisedToStaffId: input.staffId,
    });

    return result.created
      ? { ok: true, commitmentId: result.commitment.id }
      : { ok: false, error: result.reason };
  }

  // complete_commitment
  const commitmentId =
    typeof args.commitmentId === "string" ? args.commitmentId : "";
  if (!commitmentId) return { ok: false, error: "invalid_input" };

  const ok = await completeCommitment(input.admin, { commitmentId });
  return { ok };
}
