import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConciergeStationQuestions } from "@/lib/denis/config/concierge-config.schema";

const createStationQuestion = vi.fn();
vi.mock("@/lib/denis/stations/station-questions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/denis/stations/station-questions")>();
  return { ...actual, createStationQuestion: (...args: unknown[]) => createStationQuestion(...args) };
});

import {
  escalateKitchenQuestionToBar,
  isEscalationQuestion,
} from "@/lib/denis/stations/escalate-kitchen-question-to-bar";

const BASE_CONFIG: ConciergeStationQuestions = {
  enabled: true,
  foodSlaMinutes: 12,
  drinkSlaMinutes: 4,
  pendingAcceptMinutes: 2,
  readyPickupMinutes: 2,
  cooldownMinutes: 4,
  maxOpenPerStation: 3,
  expirySeconds: 90,
  meteredByCredits: false,
  escalateToBarEnabled: true,
  handsFreeWakeWordEnabled: false,
  slaPreWarnEnabled: false,
  slaPreWarnMinutes: 5,
  readBonsAloudEnabled: false,
  rollout: { mode: "off", canaryPercent: 0 },
};

const KITCHEN_QUESTION = {
  id: "q1",
  location_id: "loc-1",
  order_id: "order-1",
  table_id: "table-1",
  station: "kitchen" as const,
  question_type: "eta" as const,
  status: "expired" as const,
  message: "Kada je gotova porudžbina za sto 4?",
  answer: null,
  answer_eta_minutes: null,
  answered_by: null,
  asked_by: "denis" as const,
  source_event: null,
  asked_at: new Date().toISOString(),
  answered_at: null,
  expires_at: new Date().toISOString(),
};

const admin = {} as SupabaseClient;

describe("escalateKitchenQuestionToBar", () => {
  it("does nothing when escalateToBarEnabled is false", async () => {
    const result = await escalateKitchenQuestionToBar(admin, KITCHEN_QUESTION, {
      ...BASE_CONFIG,
      escalateToBarEnabled: false,
    });
    expect(result).toEqual({ escalated: false, reason: "disabled" });
    expect(createStationQuestion).not.toHaveBeenCalled();
  });

  it("does nothing for a bar-station question (one-directional, kitchen -> bar only)", async () => {
    const result = await escalateKitchenQuestionToBar(
      admin,
      { ...KITCHEN_QUESTION, station: "bar" },
      BASE_CONFIG
    );
    expect(result).toEqual({ escalated: false, reason: "not_kitchen" });
    expect(createStationQuestion).not.toHaveBeenCalled();
  });

  it("does nothing when the expiring question is itself already an escalation (no second hop)", async () => {
    const result = await escalateKitchenQuestionToBar(
      admin,
      { ...KITCHEN_QUESTION, source_event: "escalation_from:q0" },
      BASE_CONFIG
    );
    expect(result).toEqual({ escalated: false, reason: "already_escalation" });
    expect(createStationQuestion).not.toHaveBeenCalled();
  });

  it("does nothing when the question has no order to escalate against", async () => {
    const result = await escalateKitchenQuestionToBar(
      admin,
      { ...KITCHEN_QUESTION, order_id: null },
      BASE_CONFIG
    );
    expect(result).toEqual({ escalated: false, reason: "no_order" });
    expect(createStationQuestion).not.toHaveBeenCalled();
  });

  it("opens a bar question tagged with the escalation source, asked_by denis", async () => {
    createStationQuestion.mockResolvedValueOnce({
      created: true,
      question: { ...KITCHEN_QUESTION, id: "q2", station: "bar" },
    });

    const result = await escalateKitchenQuestionToBar(admin, KITCHEN_QUESTION, BASE_CONFIG);

    expect(result).toEqual({ escalated: true });
    expect(createStationQuestion).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        locationId: "loc-1",
        orderId: "order-1",
        tableId: "table-1",
        station: "bar",
        questionType: "eta",
        askedBy: "denis",
        sourceEvent: "escalation_from:q1",
        config: BASE_CONFIG,
      })
    );
  });

  it("reports create_failed when createStationQuestion declines (e.g. already_open)", async () => {
    createStationQuestion.mockResolvedValueOnce({ created: false, reason: "already_open" });

    const result = await escalateKitchenQuestionToBar(admin, KITCHEN_QUESTION, BASE_CONFIG);

    expect(result).toEqual({
      escalated: false,
      reason: "create_failed",
      createReason: "already_open",
    });
  });
});

describe("isEscalationQuestion", () => {
  it("recognizes a question created via escalation", () => {
    expect(isEscalationQuestion({ source_event: "escalation_from:abc" })).toBe(true);
  });

  it("returns false for a normal or null source_event", () => {
    expect(isEscalationQuestion({ source_event: null })).toBe(false);
    expect(isEscalationQuestion({ source_event: "trigger:T2" })).toBe(false);
  });
});
