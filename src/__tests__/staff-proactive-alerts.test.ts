import { describe, expect, it } from "vitest";
import {
  actionUrlForStaffProactiveAlert,
  detectStaffProactiveAlerts,
  isGuestFrustrated,
  priorityForStaffProactiveAlert,
  STAFF_ATTENTION_GUEST_MESSAGE_MIN,
} from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import { staffProactiveAlertToCopilotAction } from "@/lib/denis/venue/copilot/map-staff-proactive-alert";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

const baseInput = {
  config: CONCIERGE_PLATFORM_DEFAULTS,
  tableName: "7",
  idleMinutes: 0,
  hasSessionOrders: false,
  guestMessageCount: 0,
  hasKitchenResponse: false,
  emittedKeys: [] as string[],
  recentGuestMessages: [] as string[],
  waiterEscalated: false,
};

describe("staff_table_idle", () => {
  it("emits alert after 15 min without an order", () => {
    const alerts = detectStaffProactiveAlerts({
      ...baseInput,
      idleMinutes: 16,
    });

    expect(alerts.some((alert) => alert.kind === "staff_table_idle")).toBe(true);
    expect(alerts.find((alert) => alert.kind === "staff_table_idle")?.message).toContain(
      "bez narudžbine"
    );
  });

  it("does not emit when the table already ordered", () => {
    const alerts = detectStaffProactiveAlerts({
      ...baseInput,
      idleMinutes: 20,
      hasSessionOrders: true,
    });

    expect(alerts.some((alert) => alert.kind === "staff_table_idle")).toBe(false);
  });
});

describe("staff_frustrated_guest", () => {
  it("emits Pređi na sto alert when guest affect is frustrated", () => {
    expect(
      isGuestFrustrated({
        frustration: { level: "high", signals: ["repeat_question"] },
        sentiment: { score: -0.4, lastSignals: [] },
      })
    ).toBe(true);

    const alerts = detectStaffProactiveAlerts({
      ...baseInput,
      guestAffect: {
        frustration: { level: "high", signals: ["repeat_question"] },
        sentiment: { score: -0.4, lastSignals: [] },
      },
    });

    const alert = alerts.find((alert) => alert.kind === "staff_frustrated_guest");
    expect(alert?.message).toBe("Pređi na sto 7");

    const copilot = staffProactiveAlertToCopilotAction(alert!);
    expect(copilot?.actionPriority).toBe("urgent");
  });
});

describe("staff_allergy", () => {
  it("emits kitchen ALLERGY ALERT", () => {
    const alerts = detectStaffProactiveAlerts({
      ...baseInput,
      recentGuestMessages: ["Imam alergiju na kikiriki"],
    });

    const alert = alerts.find((alert) => alert.kind === "staff_allergy");
    expect(alert?.message).toContain("ALLERGY ALERT");
    expect(alert?.message).toContain("Sto 7");
    expect(actionUrlForStaffProactiveAlert({ kind: "staff_allergy" })).toBe(
      "/kitchen"
    );
    expect(priorityForStaffProactiveAlert("staff_allergy")).toBe("urgent");
  });
});

describe("staff_attention_escalation", () => {
  it(`fires HITNO after ${STAFF_ATTENTION_GUEST_MESSAGE_MIN}+ guest messages with no kitchen response`, () => {
    const alerts = detectStaffProactiveAlerts({
      ...baseInput,
      guestMessageCount: STAFF_ATTENTION_GUEST_MESSAGE_MIN,
      hasKitchenResponse: false,
    });

    const alert = alerts.find((alert) => alert.kind === "staff_attention_escalation");
    expect(alert?.message).toContain("HITNO");
    expect(priorityForStaffProactiveAlert("staff_attention_escalation")).toBe(
      "urgent"
    );
  });
});

describe("staff_waiter_request", () => {
  it("detects Pozovi konobara request", () => {
    const alerts = detectStaffProactiveAlerts({
      ...baseInput,
      recentGuestMessages: ["Pozovi konobara molim"],
    });

    expect(alerts.some((alert) => alert.kind === "staff_waiter_request")).toBe(true);
  });
});

describe("staff_storno_suggestion", () => {
  it("suggests storno when guest asks to cancel a signed order", () => {
    const alerts = detectStaffProactiveAlerts({
      ...baseInput,
      recentGuestMessages: ["Molim storno porudžbine"],
      sessionOrder: {
        orderId: "order-1",
        orderNumber: 12,
        tseSigned: true,
        hasStorno: false,
        paymentMethod: "online",
        total: 18,
      },
    });

    const alert = alerts.find((row) => row.kind === "staff_storno_suggestion");
    expect(alert?.message).toContain("predloži storno #12");

    const copilot = staffProactiveAlertToCopilotAction(alert!);
    expect(copilot?.actionPriority).toBe("high");
  });
});
