import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenAiToolDefinition } from "@/lib/ai/types";
import { addRestaurantKnowledge } from "@/lib/denis/knowledge/restaurant-knowledge-store";
import { loadStaffCopilotSnapshot } from "@/lib/denis/venue/copilot/load-staff-copilot-snapshot";

/**
 * Tool catalog for the owner/manager voice conversation surface (distinct
 * from the guest-turn agentic catalog in tool-catalog.ts, which is scoped
 * to a single table session — an owner asking "how's the kitchen" has no
 * table in play, they want the venue-wide picture).
 *
 * get_venue_status is deliberately one rich tool rather than many granular
 * ones: fewer Realtime round-trips, and loadStaffCopilotSnapshot already
 * computes everything an owner would plausibly ask about in one
 * already-cached call (8s TTL).
 *
 * remember_restaurant_knowledge is the one side-effecting tool here — the
 * owner telling Denis a durable fact/rule by voice ("zapamti da...") is the
 * spoken equivalent of the admin text-entry panel (restaurant-knowledge-store.ts),
 * same store, same guest-turn reach, tagged source: "owner_voice".
 */

export type OwnerVoiceToolName =
  | "get_venue_status"
  | "remember_restaurant_knowledge";

export type OwnerVoiceToolExecutorInput = {
  admin: SupabaseClient;
  locationId: string;
  staffId: string;
  staffRole: string;
};

export type OwnerVoiceToolDefinition = {
  definition: OpenAiToolDefinition;
  execute: (
    input: OwnerVoiceToolExecutorInput,
    args: Record<string, unknown>
  ) => Promise<unknown>;
};

const getVenueStatus: OwnerVoiceToolDefinition = {
  definition: {
    name: "get_venue_status",
    description:
      "Get this venue's current live status right now: kitchen backlog/stress, active order count, and which tables need attention. Always call this before answering any question about how service is going, whether the kitchen is behind, or which tables have issues — never guess or answer from memory.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  execute: async ({ admin, locationId, staffRole }) => {
    const snapshot = await loadStaffCopilotSnapshot(admin, {
      locationId,
      staffRole,
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
  },
};

const rememberRestaurantKnowledge: OwnerVoiceToolDefinition = {
  definition: {
    name: "remember_restaurant_knowledge",
    description:
      "Call this when the owner or manager tells you something you should always know going forward — a rule, a fact about the restaurant, a standing instruction. Only call it for things meant to be remembered permanently, not one-off requests. Confirm back what you saved in one short sentence.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "The fact or rule to remember, written as a short, clear standalone sentence (not a transcript of what they said).",
        },
      },
      required: ["text"],
    },
  },
  execute: async ({ admin, locationId, staffId }, args) => {
    const text = typeof args.text === "string" ? args.text : "";
    if (!text.trim()) return { ok: false, error: "empty_text" };

    return addRestaurantKnowledge(admin, {
      locationId,
      text,
      source: "owner_voice",
      createdByStaffId: staffId,
    });
  },
};

const OWNER_VOICE_TOOL_CATALOG: Record<OwnerVoiceToolName, OwnerVoiceToolDefinition> = {
  get_venue_status: getVenueStatus,
  remember_restaurant_knowledge: rememberRestaurantKnowledge,
};

export function listOwnerVoiceToolDefinitions(): OpenAiToolDefinition[] {
  return Object.values(OWNER_VOICE_TOOL_CATALOG).map((tool) => tool.definition);
}

export function isOwnerVoiceToolName(name: string): name is OwnerVoiceToolName {
  return name in OWNER_VOICE_TOOL_CATALOG;
}

export async function executeOwnerVoiceTool(
  name: OwnerVoiceToolName,
  input: OwnerVoiceToolExecutorInput,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  return OWNER_VOICE_TOOL_CATALOG[name].execute(input, args);
}
