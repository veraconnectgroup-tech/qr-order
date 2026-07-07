import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expireStationQuestions } from "@/lib/denis/stations/station-questions";

vi.mock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
  dispatchStaffNotification: vi.fn().mockResolvedValue(undefined),
}));

const appendDenisTimelineEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/denis/platform/append-timeline-event", () => ({
  appendDenisTimelineEvent: (...args: unknown[]) => appendDenisTimelineEvent(...args),
}));

const OPEN_ROW = {
  id: "q1",
  location_id: "loc-1",
  order_id: null,
  table_id: null,
  station: "kitchen" as const,
  question_type: "eta" as const,
  message: "x",
  answer: null,
  answer_eta_minutes: null,
  answered_by: null,
  asked_by: "denis" as const,
  source_event: null,
  asked_at: new Date().toISOString(),
  answered_at: null,
  expires_at: new Date().toISOString(),
};

function buildAdmin() {
  return {
    from: (table: string) => {
      if (table === "station_questions") {
        return {
          update: () => ({
            eq: () => ({
              eq: () => ({
                lt: () => ({
                  select: async () => ({ data: [OPEN_ROW], error: null }),
                }),
                select: async () => ({ data: [OPEN_ROW], error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("expireStationQuestions reason tagging", () => {
  it("day_close reason expires open questions, bypassing the expires_at TTL filter", async () => {
    const admin = buildAdmin();

    const count = await expireStationQuestions(admin, {
      locationId: "loc-1",
      reason: "day_close",
    });

    expect(count).toBe(1);
  });

  it("defaults to reason ttl when not specified", async () => {
    const admin = buildAdmin();

    const count = await expireStationQuestions(admin, { locationId: "loc-1" });

    expect(count).toBe(1);
  });
});
