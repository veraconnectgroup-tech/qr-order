import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const dispatchStaffNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
  dispatchStaffNotification: (...args: unknown[]) => dispatchStaffNotification(...args),
}));

vi.mock("@/lib/denis/platform/append-timeline-event", () => ({
  appendDenisTimelineEvent: vi.fn().mockResolvedValue(undefined),
}));

const loadConciergeConfigForLocation = vi.fn();
vi.mock("@/lib/denis/config/load-concierge-config", () => ({
  loadConciergeConfigForLocation: (...args: unknown[]) =>
    loadConciergeConfigForLocation(...args),
}));

const escalateKitchenQuestionToBar = vi.fn();
vi.mock("@/lib/denis/stations/escalate-kitchen-question-to-bar", () => ({
  escalateKitchenQuestionToBar: (...args: unknown[]) =>
    escalateKitchenQuestionToBar(...args),
  isEscalationQuestion: () => false,
}));

import { expireStationQuestions } from "@/lib/denis/stations/station-questions";

const OPEN_ROW = {
  id: "q1",
  location_id: "loc-1",
  order_id: "order-1",
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

describe("expireStationQuestions escalation wiring", () => {
  it("skips the manager notification when escalation to bar succeeds", async () => {
    dispatchStaffNotification.mockClear();
    loadConciergeConfigForLocation.mockResolvedValue({
      ops: { stationQuestions: { escalateToBarEnabled: true } },
    });
    escalateKitchenQuestionToBar.mockResolvedValue({ escalated: true });

    await expireStationQuestions(buildAdmin(), { locationId: "loc-1" });

    expect(escalateKitchenQuestionToBar).toHaveBeenCalledTimes(1);
    expect(dispatchStaffNotification).not.toHaveBeenCalled();
  });

  it("falls back to the manager notification when escalation doesn't happen", async () => {
    dispatchStaffNotification.mockClear();
    loadConciergeConfigForLocation.mockResolvedValue({
      ops: { stationQuestions: { escalateToBarEnabled: true } },
    });
    escalateKitchenQuestionToBar.mockResolvedValue({
      escalated: false,
      reason: "create_failed",
    });

    await expireStationQuestions(buildAdmin(), { locationId: "loc-1" });

    expect(dispatchStaffNotification).toHaveBeenCalledTimes(1);
  });

  it("falls back to the manager notification when the config load itself fails", async () => {
    dispatchStaffNotification.mockClear();
    escalateKitchenQuestionToBar.mockClear();
    loadConciergeConfigForLocation.mockRejectedValue(new Error("redis down"));

    await expireStationQuestions(buildAdmin(), { locationId: "loc-1" });

    expect(escalateKitchenQuestionToBar).not.toHaveBeenCalled();
    expect(dispatchStaffNotification).toHaveBeenCalledTimes(1);
  });
});
