import { describe, expect, it, vi } from "vitest";
import { runDenisDayClose } from "@/lib/denis/memory/day-close";
import type { SupabaseClient } from "@supabase/supabase-js";

type OpenQuestion = { id: string; location_id: string; station: "kitchen" | "bar" };

function buildAdmin(input: {
  existingDayClose: { summary: unknown } | null;
  openQuestions: OpenQuestion[];
}) {
  const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
  const updated: Array<{ table: string; status: string }> = [];
  const deleted: Array<{ table: string; count: number }> = [];

  const from = (table: string) => {
    if (table === "denis_day_closes") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: input.existingDayClose,
                error: null,
              }),
            }),
          }),
        }),
        insert: async (row: Record<string, unknown>) => {
          inserted.push({ table, row });
          return { error: null };
        },
      };
    }

    if (table === "station_questions") {
      return {
        update: (patch: { status: string }) => ({
          eq: () => ({
            eq: () => ({
              select: async () => {
                updated.push({ table, status: patch.status });
                return {
                  data: input.openQuestions.map((q) => ({
                    ...q,
                    status: patch.status,
                    order_id: null,
                    table_id: null,
                    question_type: "eta",
                    message: "x",
                    answer: null,
                    answer_eta_minutes: null,
                    answered_by: null,
                    asked_by: "denis",
                    source_event: null,
                    asked_at: new Date().toISOString(),
                    answered_at: null,
                    expires_at: new Date().toISOString(),
                  })),
                  error: null,
                };
              },
            }),
          }),
        }),
        select: () => ({
          eq: async () => ({
            data: input.openQuestions.map((q) => ({ id: q.id })),
            error: null,
          }),
        }),
      };
    }

    if (table === "orders" || table === "tables" || table === "locations" || table === "table_sessions") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      };
    }

    if (table === "station_question_turns") {
      return {
        delete: () => ({
          in: () => ({
            lt: () => ({
              select: async () => ({
                data: input.openQuestions.map((q) => ({ id: `${q.id}-turn` })),
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    if (
      table === "table_bus_obligations" ||
      table === "waiter_calls"
    ) {
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            eq: () => ({
              select: async () => {
                updated.push({ table, status: String(patch.status ?? "updated") });
                return { data: [{ id: `${table}-1` }], error: null };
              },
            }),
            in: () => ({
              select: async () => {
                updated.push({ table, status: String(patch.status ?? "updated") });
                return { data: [{ id: `${table}-1` }], error: null };
              },
            }),
          }),
        }),
      };
    }

    if (table === "denis_staff_table_hints" || table === "denis_schedules") {
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            in: () => ({
              select: async () => {
                updated.push({ table, status: String(patch.status ?? "updated") });
                return { data: [{ id: `${table}-1` }], error: null };
              },
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            is: () => ({
              select: async () => {
                deleted.push({ table, count: 1 });
                return { data: [{ id: `${table}-1` }], error: null };
              },
            }),
            in: () => ({
              select: async () => {
                deleted.push({ table, count: 1 });
                return { data: [{ id: `${table}-1` }], error: null };
              },
            }),
          }),
        }),
      };
    }

    throw new Error(`unexpected table ${table}`);
  };

  return {
    admin: { from } as unknown as SupabaseClient,
    inserted,
    updated,
    deleted,
  };
}

vi.mock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
  dispatchStaffNotification: vi.fn().mockResolvedValue(undefined),
}));

describe("runDenisDayClose", () => {
  it("closes all shift-tier registry entries and records the day close row", async () => {
    const { admin, inserted } = buildAdmin({
      existingDayClose: null,
      openQuestions: [{ id: "q1", location_id: "loc-1", station: "kitchen" }],
    });

    const result = await runDenisDayClose(admin, {
      locationId: "loc-1",
      businessDate: "2026-07-06",
    });

    expect(result.alreadyClosed).toBe(false);
    expect(result.summary.expiredStationQuestions).toBe(1);
    expect(result.summary.expiredStationQuestionTurns).toBe(1);
    expect(result.summary.cancelledBusObligations).toBe(1);
    expect(result.summary.resolvedWaiterCalls).toBe(1);
    expect(result.summary.deletedStaffTableHints).toBe(1);
    expect(result.summary.cancelledSchedules).toBe(1);
    expect(result.summary.deletedSchedules).toBe(1);
    expect(result.summary.processed).toEqual(
      expect.arrayContaining([
        "station_questions",
        "station_question_turns",
        "table_bus_obligations",
        "denis_staff_table_hints",
        "waiter_calls",
        "denis_schedules",
      ])
    );
    expect(result.summary.skipped).toEqual([]);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe("denis_day_closes");
    expect(inserted[0].row).toMatchObject({
      location_id: "loc-1",
      business_date: "2026-07-06",
    });
  });

  it("is a no-op on a repeat call for the same location+date", async () => {
    const { admin, inserted, updated } = buildAdmin({
      existingDayClose: {
        summary: {
          processed: ["station_questions", "station_question_turns"],
          skipped: [],
          expiredStationQuestions: 1,
          expiredStationQuestionTurns: 1,
          cancelledBusObligations: 0,
          resolvedWaiterCalls: 0,
          deletedStaffTableHints: 0,
          cancelledSchedules: 0,
          deletedSchedules: 0,
        },
      },
      openQuestions: [{ id: "q1", location_id: "loc-1", station: "kitchen" }],
    });

    const result = await runDenisDayClose(admin, {
      locationId: "loc-1",
      businessDate: "2026-07-06",
    });

    expect(result.alreadyClosed).toBe(true);
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });
});
