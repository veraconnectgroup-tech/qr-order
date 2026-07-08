import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenAiToolDefinition } from "@/lib/ai/types";
import { loadStaffCopilotSnapshot } from "@/lib/denis/venue/copilot/load-staff-copilot-snapshot";

/**
 * Read-only tool catalog for the owner/manager voice conversation surface
 * (distinct from the guest-turn agentic catalog in tool-catalog.ts, which
 * is scoped to a single table session — an owner asking "how's the kitchen"
 * has no table in play, they want the venue-wide picture).
 *
 * Deliberately one rich tool rather than many granular ones: fewer Realtime
 * round-trips, and loadStaffCopilotSnapshot already computes everything an
 * owner would plausibly ask about in one already-cached call (8s TTL).
 *
 * No side-effecting tools here — this surface only answers questions.
 */

export type OwnerVoiceToolName = "get_venue_status";

export type OwnerVoiceToolExecutorInput = {
  admin: SupabaseClient;
  locationId: string;
  staffRole: string;
};

export type OwnerVoiceToolDefinition = {
  definition: OpenAiToolDefinition;
  execute: (input: OwnerVoiceToolExecutorInput) => Promise<unknown>;
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

const OWNER_VOICE_TOOL_CATALOG: Record<OwnerVoiceToolName, OwnerVoiceToolDefinition> = {
  get_venue_status: getVenueStatus,
};

export function listOwnerVoiceToolDefinitions(): OpenAiToolDefinition[] {
  return Object.values(OWNER_VOICE_TOOL_CATALOG).map((tool) => tool.definition);
}

export function isOwnerVoiceToolName(name: string): name is OwnerVoiceToolName {
  return name in OWNER_VOICE_TOOL_CATALOG;
}

export async function executeOwnerVoiceTool(
  name: OwnerVoiceToolName,
  input: OwnerVoiceToolExecutorInput
): Promise<unknown> {
  return OWNER_VOICE_TOOL_CATALOG[name].execute(input);
}
