import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addRestaurantKnowledge,
  formatRestaurantKnowledgeBlock,
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
