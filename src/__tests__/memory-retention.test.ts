import { describe, expect, it, vi } from "vitest";
import {
  AUDIT_TABLES_HARD_EXEMPT,
  runMemoryRetentionSweep,
} from "@/lib/denis/memory/memory-retention";
import { entriesWithExpiredRetention } from "@/lib/denis/memory/memory-registry";
import type { SupabaseClient } from "@supabase/supabase-js";

function buildRetentionAdmin() {
  const deleted: Record<string, number> = {};

  const from = (table: string) => {
    if (table === "locations") {
      return {
        select: () => ({
          limit: async () => ({
            data: [{ id: "loc-1" }],
            error: null,
          }),
        }),
      };
    }

    if (table === "station_questions") {
      return {
        select: () => ({
          eq: async () => ({
            data: [{ id: "q1" }],
            error: null,
          }),
        }),
        delete: () => ({
          in: () => ({
            lt: () => ({
              limit: () => ({
                select: async () => {
                  deleted[table] = (deleted[table] ?? 0) + 2;
                  return { data: [{ id: "1" }, { id: "2" }], error: null };
                },
              }),
            }),
          }),
        }),
      };
    }

    if (table === "station_question_turns") {
      return {
        delete: () => ({
          in: () => ({
            lt: () => ({
              select: async () => {
                deleted[table] = (deleted[table] ?? 0) + 1;
                return { data: [{ id: "t1" }], error: null };
              },
            }),
          }),
        }),
      };
    }

    return {
      delete: () => ({
        in: () => ({
          lt: () => ({
            limit: () => ({
              select: async () => {
                deleted[table] = (deleted[table] ?? 0) + 1;
                return { data: [{ id: "1" }], error: null };
              },
            }),
          }),
        }),
        lt: () => ({
          limit: () => ({
            select: async () => {
              deleted[table] = (deleted[table] ?? 0) + 1;
              return { data: [{ id: "1" }], error: null };
            },
          }),
        }),
      }),
    };
  };

  return {
    admin: { from } as unknown as SupabaseClient,
    deleted,
  };
}

describe("memory-retention", () => {
  it("never sweeps hard-exempt audit tables", () => {
    for (const table of AUDIT_TABLES_HARD_EXEMPT) {
      expect(entriesWithExpiredRetention().some((entry) => entry.table === table)).toBe(
        false
      );
    }
  });

  it("deletes expired shift-tier rows per registry and skips denis_turn_traces duplicate", async () => {
    const { admin, deleted } = buildRetentionAdmin();
    const summary = await runMemoryRetentionSweep(
      admin,
      new Date("2026-07-08T12:00:00.000Z")
    );

    expect(summary.skipped).toContain("denis_turn_traces");
    expect(summary.processed.some((row) => row.table === "waiter_calls")).toBe(true);
    expect(deleted.waiter_calls ?? 0).toBeGreaterThan(0);
  });
});
