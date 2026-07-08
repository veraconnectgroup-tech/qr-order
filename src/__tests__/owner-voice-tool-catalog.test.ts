import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executeOwnerVoiceTool,
  isOwnerVoiceToolName,
  listOwnerVoiceToolDefinitions,
} from "@/lib/denis/agentic/owner-voice-tool-catalog";
import type { StaffCopilotSnapshot } from "@/lib/denis/venue/copilot/types";

const { loadStaffCopilotSnapshotMock, addRestaurantKnowledgeMock } = vi.hoisted(() => ({
  loadStaffCopilotSnapshotMock: vi.fn(),
  addRestaurantKnowledgeMock: vi.fn(),
}));

vi.mock("@/lib/denis/venue/copilot/load-staff-copilot-snapshot", () => ({
  loadStaffCopilotSnapshot: loadStaffCopilotSnapshotMock,
}));

vi.mock("@/lib/denis/knowledge/restaurant-knowledge-store", () => ({
  addRestaurantKnowledge: addRestaurantKnowledgeMock,
}));

function buildSnapshot(overrides: Partial<StaffCopilotSnapshot> = {}): StaffCopilotSnapshot {
  return {
    enabled: true,
    at: new Date().toISOString(),
    operatingMode: "normal",
    kdsStress: "normal",
    kdsBacklogMinutes: null,
    activeOrderCount: 0,
    floorGraphEnabled: false,
    autoRushEnabled: false,
    autoRushBacklogMinutes: 20,
    rushModeSuggestion: null,
    canManageOps: true,
    canSetTableHints: true,
    priorityTables: [],
    tables: [],
    eventBlock: null,
    gatheringHint: null,
    learnedPairingsBlock: null,
    inventoryBrief: null,
    prepBriefingBlock: null,
    ...overrides,
  };
}

describe("owner-voice-tool-catalog", () => {
  it("lists get_venue_status as a tool definition", () => {
    const tools = listOwnerVoiceToolDefinitions();
    expect(tools.some((tool) => tool.name === "get_venue_status")).toBe(true);
  });

  it("recognizes only real tool names", () => {
    expect(isOwnerVoiceToolName("get_venue_status")).toBe(true);
    expect(isOwnerVoiceToolName("add_to_order")).toBe(false);
    expect(isOwnerVoiceToolName("drop_table_orders")).toBe(false);
  });

  it("maps the staff copilot snapshot into a venue-status payload", async () => {
    loadStaffCopilotSnapshotMock.mockResolvedValue(
      buildSnapshot({
        kdsStress: "high",
        kdsBacklogMinutes: 18,
        activeOrderCount: 7,
        rushModeSuggestion: "Kitchen is behind — consider auto rush.",
        priorityTables: [
          {
            tableId: "t1",
            tableName: "Sto 4",
            priority: "urgent",
            operatingHint: "needs_attention",
            openOrderCount: 2,
            seatedMinutes: 40,
            hasActiveSession: true,
            guestWaitMinutes: 22,
            staffHint: null,
            staffBrief: "Guest waiting on mains.",
            revenueOpportunity: "none",
          },
        ],
      })
    );

    const result = (await executeOwnerVoiceTool("get_venue_status", {
      admin: {} as SupabaseClient,
      locationId: "loc-1",
      staffId: "staff-1",
      staffRole: "owner",
    })) as {
      kdsStress: string;
      kdsBacklogMinutes: number | null;
      activeOrderCount: number;
      tablesNeedingAttention: Array<{ tableName: string; guestWaitMinutes: number | null }>;
    };

    expect(loadStaffCopilotSnapshotMock).toHaveBeenCalledWith(expect.anything(), {
      locationId: "loc-1",
      staffRole: "owner",
    });
    expect(result.kdsStress).toBe("high");
    expect(result.kdsBacklogMinutes).toBe(18);
    expect(result.activeOrderCount).toBe(7);
    expect(result.tablesNeedingAttention).toHaveLength(1);
    expect(result.tablesNeedingAttention[0]).toMatchObject({
      tableName: "Sto 4",
      guestWaitMinutes: 22,
    });
  });

  it("lists remember_restaurant_knowledge as a tool definition", () => {
    const tools = listOwnerVoiceToolDefinitions();
    expect(
      tools.some((tool) => tool.name === "remember_restaurant_knowledge")
    ).toBe(true);
  });

  it("saves what the owner said to remember, tagged as owner_voice", async () => {
    addRestaurantKnowledgeMock.mockResolvedValue({ ok: true, id: "k1" });

    const result = await executeOwnerVoiceTool(
      "remember_restaurant_knowledge",
      {
        admin: {} as SupabaseClient,
        locationId: "loc-1",
        staffId: "staff-1",
        staffRole: "owner",
      },
      { text: "We don't do substitutions on the tasting menu." }
    );

    expect(addRestaurantKnowledgeMock).toHaveBeenCalledWith(expect.anything(), {
      locationId: "loc-1",
      text: "We don't do substitutions on the tasting menu.",
      source: "owner_voice",
      createdByStaffId: "staff-1",
    });
    expect(result).toEqual({ ok: true, id: "k1" });
  });

  it("rejects an empty remember_restaurant_knowledge call without touching the store", async () => {
    addRestaurantKnowledgeMock.mockClear();
    const result = await executeOwnerVoiceTool(
      "remember_restaurant_knowledge",
      {
        admin: {} as SupabaseClient,
        locationId: "loc-1",
        staffId: "staff-1",
        staffRole: "owner",
      },
      { text: "   " }
    );

    expect(result).toEqual({ ok: false, error: "empty_text" });
    expect(addRestaurantKnowledgeMock).not.toHaveBeenCalled();
  });
});
