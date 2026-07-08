import { describe, expect, it, vi } from "vitest";
import { forgetGuestCompletely } from "@/lib/denis/memory/forget-guest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/guest/denis-guest-memory-store", () => ({
  deleteGuestMemory: vi.fn().mockResolvedValue(true),
}));

function buildForgetAdmin() {
  const tables: Record<string, string[]> = {
    denis_guest_memory: ["mem-1"],
    guest_notification_preferences: ["pref-1"],
    session_devices: [{ session_id: "sess-1" } as unknown as string],
    table_sessions: [{ table_id: "table-1" } as unknown as string],
    ai_sessions: [{ id: "ai-1" } as unknown as string],
    denis_turn_traces: ["trace-1"],
    denis_timeline: ["tl-1"],
  };

  const from = (table: string) => {
    if (table === "denis_guest_memory") {
      return {
        delete: () => ({
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      };
    }

    if (table === "guest_notification_preferences") {
      return {
        delete: () => ({
          eq: () => ({
            eq: () => ({
              select: async () => ({
                data: [{ id: "pref-1" }],
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    if (table === "session_devices") {
      return {
        select: () => ({
          eq: async () => ({
            data: [{ session_id: "sess-1" }],
            error: null,
          }),
        }),
      };
    }

    if (table === "table_sessions") {
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: [{ table_id: "table-1" }],
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "ai_sessions") {
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: [{ id: "ai-1" }],
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "denis_turn_traces" || table === "denis_timeline") {
      return {
        delete: () => ({
          eq: () => ({
            in: () => ({
              select: async () => ({
                data: [{ id: `${table}-1` }],
                error: null,
              }),
            }),
          }),
          in: () => ({
            select: async () => ({
              data: [{ id: `${table}-1` }],
              error: null,
            }),
          }),
        }),
      };
    }

    throw new Error(`unexpected table ${table}`);
  };

  return {
    admin: { from } as unknown as SupabaseClient,
    tables,
  };
}

describe("forgetGuestCompletely", () => {
  it("deletes device memory, notification prefs, and PII shift traces without touching orders", async () => {
    const { admin } = buildForgetAdmin();

    const result = await forgetGuestCompletely(admin, {
      locationId: "loc-1",
      deviceFingerprint: "fingerprint-abc12345",
    });

    expect(result.memoryDeleted).toBe(true);
    expect(result.notificationPrefsDeleted).toBe(1);
    expect(result.turnTracesDeleted).toBe(1);
    expect(result.timelineEventsDeleted).toBe(1);
  });
});
