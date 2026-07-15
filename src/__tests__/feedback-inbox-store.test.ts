import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadFeedbackInboxNeedingResponse,
  markFeedbackInboxHandled,
} from "@/lib/feedback/feedback-inbox-store";

describe("loadFeedbackInboxNeedingResponse", () => {
  it("queries feedback_inbox scoped to the location and needs_response=true, mapped to camelCase", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "fb-1",
          sentiment: "negative",
          category: "service",
          rating: 2,
          comment: "Waited too long.",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const eq2 = vi.fn(() => ({ order }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const items = await loadFeedbackInboxNeedingResponse(admin, "loc-1");

    expect(select).toHaveBeenCalledWith(
      "id, sentiment, category, rating, comment, created_at"
    );
    expect(eq1).toHaveBeenCalledWith("location_id", "loc-1");
    expect(eq2).toHaveBeenCalledWith("needs_response", true);
    expect(items).toEqual([
      {
        id: "fb-1",
        sentiment: "negative",
        category: "service",
        rating: 2,
        comment: "Waited too long.",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("degrades to an empty array on error", async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "db down" },
    });
    const eq2 = vi.fn(() => ({ order }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const items = await loadFeedbackInboxNeedingResponse(admin, "loc-1");
    expect(items).toEqual([]);
  });
});

describe("markFeedbackInboxHandled", () => {
  it("updates needs_response=false scoped to id and location, returns true on success", async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null });
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const update = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ update }) } as unknown as SupabaseClient;

    const ok = await markFeedbackInboxHandled(admin, {
      id: "fb-1",
      locationId: "loc-1",
      staffId: "staff-1",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        needs_response: false,
        responded_by: "staff-1",
      })
    );
    expect(eq1).toHaveBeenCalledWith("id", "fb-1");
    expect(eq2).toHaveBeenCalledWith("location_id", "loc-1");
    expect(ok).toBe(true);
  });

  it("returns false on error", async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const update = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ update }) } as unknown as SupabaseClient;

    const ok = await markFeedbackInboxHandled(admin, {
      id: "fb-1",
      locationId: "loc-1",
      staffId: "staff-1",
    });

    expect(ok).toBe(false);
  });
});
