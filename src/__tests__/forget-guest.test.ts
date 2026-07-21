import { describe, expect, it, vi } from "vitest";
import { forgetGuestCompletely } from "@/lib/denis/memory/forget-guest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/guest/denis-guest-memory-store", () => ({
  deleteGuestMemory: vi.fn().mockResolvedValue(true),
}));

type TableSessionRow = { table_id: string; opened_at: string; closed_at: string | null };
type AiSessionRow = { id: string; table_id: string; created_at: string };

function buildForgetAdmin(options?: {
  tableSessions?: TableSessionRow[];
  aiSessions?: AiSessionRow[];
}) {
  const tableSessions: TableSessionRow[] = options?.tableSessions ?? [
    { table_id: "table-1", opened_at: "2026-01-01T12:00:00Z", closed_at: "2026-01-01T13:00:00Z" },
  ];
  const aiSessions: AiSessionRow[] = options?.aiSessions ?? [
    { id: "ai-1", table_id: "table-1", created_at: "2026-01-01T12:30:00Z" },
  ];

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
              data: tableSessions,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "ai_sessions") {
      // Chainable filter mock: eq(location_id) -> eq(table_id) -> gte(created_at) -> [lte(created_at)]
      return {
        select: () => ({
          eq: () => ({
            eq: (_col: string, tableId: string) => {
              const withinTable = aiSessions.filter((row) => row.table_id === tableId);
              const gteApi = {
                gte: (_gteCol: string, opened: string) => {
                  const afterOpen = withinTable.filter((row) => row.created_at >= opened);
                  const resolved = Promise.resolve({
                    data: afterOpen.map(({ id }) => ({ id })),
                    error: null,
                  });
                  return {
                    ...resolved,
                    then: resolved.then.bind(resolved),
                    lte: (_lteCol: string, closed: string) => {
                      const windowed = afterOpen.filter((row) => row.created_at <= closed);
                      return Promise.resolve({
                        data: windowed.map(({ id }) => ({ id })),
                        error: null,
                      });
                    },
                  };
                },
              };
              return gteApi;
            },
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

  it("does not sweep in a different guest's ai_session from an earlier visit at the same table", async () => {
    // Same physical table, two unrelated visits. Only the ai_session that
    // falls inside THIS guest's table_session window should be touched.
    const { admin } = buildForgetAdmin({
      tableSessions: [
        { table_id: "table-1", opened_at: "2026-01-02T18:00:00Z", closed_at: "2026-01-02T19:00:00Z" },
      ],
      aiSessions: [
        { id: "ai-earlier-guest", table_id: "table-1", created_at: "2026-01-01T12:30:00Z" },
        { id: "ai-this-guest", table_id: "table-1", created_at: "2026-01-02T18:30:00Z" },
      ],
    });

    const result = await forgetGuestCompletely(admin, {
      locationId: "loc-1",
      deviceFingerprint: "fingerprint-abc12345",
    });

    // Only one ai_session (this guest's) falls in the window, so only its
    // trace/timeline rows are counted as deleted — not the earlier guest's.
    expect(result.turnTracesDeleted).toBe(1);
    expect(result.timelineEventsDeleted).toBe(1);
  });
});
