import { describe, expect, it, vi } from "vitest";
import { runDenisDayClose } from "@/lib/denis/memory/day-close";
import { runMemoryRetentionSweep } from "@/lib/denis/memory/memory-retention";
import { forgetGuestCompletely } from "@/lib/denis/memory/forget-guest";
import { entriesForDayClose } from "@/lib/denis/memory/memory-registry";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
  dispatchStaffNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/guest/denis-guest-memory-store", () => ({
  deleteGuestMemory: vi.fn().mockResolvedValue(true),
}));

/**
 * ADR-045 S5 — end-to-end lifecycle smoke: Day Close processes every
 * registry entry with a non-keep behavior, retention skips audit, forget
 * guest clears PII traces.
 */
describe("ADR-045 pilot lifecycle", () => {
  it("covers shift close → retention → forget without audit loss", async () => {
    const dayCloseTables = entriesForDayClose().map((entry) => entry.table);
    expect(dayCloseTables).toEqual(
      expect.arrayContaining([
        "station_questions",
        "table_bus_obligations",
        "waiter_calls",
        "denis_staff_table_hints",
        "denis_schedules",
      ])
    );

    const admin = (() => {
      let dayCloseRecorded = false;
      return {
        from: (table: string) => {
          if (table === "denis_day_closes") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: dayCloseRecorded
                        ? { summary: { processed: [], skipped: [] } }
                        : null,
                      error: null,
                    }),
                  }),
                }),
              }),
              insert: async () => {
                dayCloseRecorded = true;
                return { error: null };
              },
            };
          }

        const noopCount = async () => ({ data: [], error: null });
        const oneRow = async () => ({ data: [{ id: "1" }], error: null });

        return {
          update: () => ({
            eq: () => ({
              eq: () => ({ select: oneRow }),
              in: () => ({ select: oneRow }),
            }),
            in: () => ({ select: oneRow }),
          }),
          delete: () => ({
            in: () => ({
              lt: () => ({
                limit: () => ({ select: noopCount }),
              }),
            }),
            eq: () => ({
              is: () => ({ select: oneRow }),
              in: () => ({ select: oneRow }),
            }),
            lt: () => ({
              in: () => ({ limit: () => ({ select: noopCount }) }),
              limit: () => ({ select: noopCount }),
            }),
          }),
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            limit: async () => ({ data: [{ id: "loc-1" }], error: null }),
          }),
        };
      },
    };
    })() as unknown as SupabaseClient;

    const dayClose = await runDenisDayClose(admin, {
      locationId: "loc-1",
      businessDate: "2026-07-07",
    });
    expect(dayClose.alreadyClosed).toBe(false);
    expect(dayClose.summary.skipped).toEqual([]);

    const repeat = await runDenisDayClose(admin, {
      locationId: "loc-1",
      businessDate: "2026-07-07",
    });
    expect(repeat.alreadyClosed).toBe(true);

    const retention = await runMemoryRetentionSweep(
      admin,
      new Date("2026-07-08T12:00:00.000Z")
    );
    expect(retention.skipped).toContain("denis_turn_traces");

    const forgetAdmin = {
      from: (table: string) => {
        if (table === "session_devices") {
          return {
            select: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          };
        }
        if (table === "guest_notification_preferences") {
          return {
            delete: () => ({
              eq: () => ({
                eq: () => ({ select: async () => ({ data: [], error: null }) }),
              }),
            }),
          };
        }
        throw new Error(`unexpected forget table ${table}`);
      },
    } as unknown as SupabaseClient;

    const forget = await forgetGuestCompletely(forgetAdmin, {
      locationId: "loc-1",
      deviceFingerprint: "device-fingerprint-12345678",
    });
    expect(forget.memoryDeleted).toBe(true);
  });
});
