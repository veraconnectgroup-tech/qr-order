import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addRestaurantKnowledge,
  confirmRestaurantRuleProposal,
  expireOverduePendingRestaurantKnowledge,
  formatRestaurantKnowledgeBlock,
  listPendingRestaurantKnowledgeProposals,
  proposeRestaurantRule,
  rejectRestaurantRuleProposal,
  type RestaurantKnowledgeEntry,
} from "@/lib/denis/knowledge/restaurant-knowledge-store";

vi.mock("@/lib/redis/client", () => ({
  getRedisClient: () => null,
  logRedisDegradation: vi.fn(),
}));

describe("formatRestaurantKnowledgeBlock", () => {
  it("returns null when there are no entries", () => {
    expect(formatRestaurantKnowledgeBlock([])).toBeNull();
  });

  it("formats entries as a bulleted block under a labeled header", () => {
    const entries: RestaurantKnowledgeEntry[] = [
      { id: "1", text: "No substitutions on the tasting menu.", source: "admin_text", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", text: "Owner's name is Marko.", source: "owner_voice", createdAt: "2026-01-01T00:00:00.000Z" },
    ];

    const block = formatRestaurantKnowledgeBlock(entries);
    expect(block).toContain("RESTAURANT KNOWLEDGE");
    expect(block).toContain("- No substitutions on the tasting menu.");
    expect(block).toContain("- Owner's name is Marko.");
  });
});

describe("addRestaurantKnowledge", () => {
  it("rejects empty text without touching the database", async () => {
    const insert = vi.fn();
    const admin = { from: () => ({ insert }) } as unknown as SupabaseClient;

    const result = await addRestaurantKnowledge(admin, {
      locationId: "loc-1",
      text: "   ",
      source: "admin_text",
      createdByStaffId: "staff-1",
    });

    expect(result).toEqual({ ok: false, error: "invalid_text" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects text longer than 500 characters without touching the database", async () => {
    const insert = vi.fn();
    const admin = { from: () => ({ insert }) } as unknown as SupabaseClient;

    const result = await addRestaurantKnowledge(admin, {
      locationId: "loc-1",
      text: "a".repeat(501),
      source: "admin_text",
      createdByStaffId: "staff-1",
    });

    expect(result).toEqual({ ok: false, error: "invalid_text" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts trimmed text and returns the new id on success", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "new-id" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const admin = { from: () => ({ insert }) } as unknown as SupabaseClient;

    const result = await addRestaurantKnowledge(admin, {
      locationId: "loc-1",
      text: "  Kitchen closes orders at 22:30.  ",
      source: "admin_text",
      createdByStaffId: "staff-1",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Kitchen closes orders at 22:30." })
    );
    expect(result).toEqual({ ok: true, id: "new-id" });
  });
});

describe("rule-proposal state machine", () => {
  it("proposeRestaurantRule inserts a pending_confirmation row, never confirmed", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "proposal-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn((_row: Record<string, unknown>) => ({ select }));
    const admin = { from: () => ({ insert }) } as unknown as SupabaseClient;

    const result = await proposeRestaurantRule(admin, {
      locationId: "loc-1",
      text: "We can always swap fries for salad.",
      proposedByStaffId: "staff-1",
      sourceAiSessionId: "session-1",
    });

    expect(result).toEqual({ ok: true, id: "proposal-1" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending_confirmation",
        scope: "permanent",
        proposed_by_staff_id: "staff-1",
        source_ai_session_id: "session-1",
      })
    );
    const insertedRow = insert.mock.calls[0]![0] as { pending_expires_at: string };
    expect(new Date(insertedRow.pending_expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("proposeRestaurantRule rejects empty text without touching the database", async () => {
    const insert = vi.fn();
    const admin = { from: () => ({ insert }) } as unknown as SupabaseClient;

    const result = await proposeRestaurantRule(admin, {
      locationId: "loc-1",
      text: "   ",
      proposedByStaffId: "staff-1",
    });

    expect(result).toEqual({ ok: false, error: "invalid_text" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("listPendingRestaurantKnowledgeProposals maps rows to camelCase", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "p1",
          text: "Rule text",
          proposed_by_staff_id: "staff-1",
          source_ai_session_id: "session-1",
          created_at: "2026-01-01T00:00:00.000Z",
          pending_expires_at: "2026-01-15T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const eq2 = vi.fn(() => ({ order }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const proposals = await listPendingRestaurantKnowledgeProposals(admin, "loc-1");
    expect(proposals).toEqual([
      {
        id: "p1",
        text: "Rule text",
        proposedByStaffId: "staff-1",
        sourceAiSessionId: "session-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        pendingExpiresAt: "2026-01-15T00:00:00.000Z",
      },
    ]);
  });

  it("confirmRestaurantRuleProposal refuses a row that isn't pending", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "p1", status: "confirmed" },
      error: null,
    });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const result = await confirmRestaurantRuleProposal(admin, {
      id: "p1",
      locationId: "loc-1",
      confirmedByStaffId: "staff-2",
    });

    expect(result).toEqual({ ok: false, error: "not_pending" });
  });

  it("rejectRestaurantRuleProposal refuses a missing row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const result = await rejectRestaurantRuleProposal(admin, {
      id: "missing",
      locationId: "loc-1",
    });

    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("expireOverduePendingRestaurantKnowledge counts expired rows, degrades to 0 on error", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ id: "p1" }, { id: "p2" }],
      error: null,
    });
    const lt = vi.fn(() => ({ select }));
    const eq = vi.fn(() => ({ lt }));
    const update = vi.fn(() => ({ eq }));
    const admin = { from: () => ({ update }) } as unknown as SupabaseClient;

    const result = await expireOverduePendingRestaurantKnowledge(admin);
    expect(result).toEqual({ expired: 2 });
  });
});
